import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import {
  orderSearchableFields,
  orderRelations,
  DELIVERY_CHARGES,
  STATUS_TRANSITIONS
} from "./order.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateOrderRequest,
  IOrderFilterRequest,
  IUpdateOrderRequest,
  IUpdateOrderStatusRequest,
  IAssignBranchToItemRequest,
  ICancelOrderRequest
} from "./order.interface";
import {
  type Prisma,
  type Order,
  type DeliveryLocation,
  type PaymentMethod,
  OrderStatus
} from "../../../generated/prisma/client";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import type { IGenericResponse } from "../../../interfaces/common";
import { groupCartItemsByStoreAndBranch } from "../../../utils/branchAssignment";
import {
  reserveInventoryBulk,
  releaseInventoryBulk
} from "../inventory/inventory.helper";
import {
  generateOrderNumber,
  logOrderActivity,
  canCancelOrder,
  hasPathaoDelivery
} from "./order.helper";

// CREATE ORDER (from cart or direct checkout)
const createOrder = async (
  userId: string | undefined,
  payload: ICreateOrderRequest
): Promise<Order[]> => {
  // Use transaction to ensure atomicity
  const createdOrders = await prisma.$transaction(async (tx) => {
    // Validate store exists
    const store = await tx.store.findUnique({
      where: { id: payload.storeId, isDeleted: false }
    });

    if (!store) {
      throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
    }

    // STEP 1: Batch fetch all products and variants
    const productIds = payload.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        storeId: payload.storeId,
        isDeleted: false
      },
      include: {
        media: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    const variantIds = payload.items
      .map((item) => item.variantId)
      .filter((id): id is string => !!id);

    const variants =
      variantIds.length > 0
        ? await tx.productVariant.findMany({
            where: {
              id: { in: variantIds }
            },
            include: {
              variantAttributes: {
                include: {
                  attributeValue: {
                    include: {
                      attribute: true
                    }
                  }
                }
              }
            }
          })
        : [];

    // Create maps for O(1) lookup
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // STEP 2: Prepare cart items for branch assignment algorithm
    const cartItems = payload.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          `Product with ID ${item.productId} not found`
        );
      }

      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        storeId: payload.storeId
      };
    });

    // STEP 3: Use branch assignment algorithm to split by branch
    const storeAndBranchGroups =
      await groupCartItemsByStoreAndBranch(cartItems);

    // Get branch assignments for this store
    const branchAssignments = storeAndBranchGroups.get(payload.storeId);

    if (!branchAssignments || branchAssignments.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No branches have sufficient stock for the requested items"
      );
    }

    // STEP 4: branchAssignments is already grouped by branch
    const branchGroups = branchAssignments;

    // STEP 5: Get delivery charge
    const deliveryCharge = DELIVERY_CHARGES[payload.deliveryLocation];
    if (deliveryCharge === undefined) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid delivery location");
    }

    // STEP 6: Create multiple orders (one per branch)
    const orders: Order[] = [];

    for (const branchGroup of branchGroups) {
      const { branchId, items } = branchGroup;

      // Calculate totals for this branch's order
      let subtotal = 0;
      let totalDiscount = 0;

      const orderItemsData: {
        productId: string;
        variantId?: string;
        branchId: string;
        quantity: number;
        price: number;
        discount: number;
        total: number;
        productName: string;
        variantName: string | null;
        productImage: string | null;
      }[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Product with ID ${item.productId} not found`
          );
        }

        let price = Number(product.basePrice);
        let discount = 0;
        let variantName = null;
        let productImage = product.media[0]?.mediaUrl || null;

        // If variant is specified, get variant price
        if (item.variantId) {
          const variant = variantMap.get(item.variantId);
          if (!variant) {
            throw new ApiError(
              httpStatus.NOT_FOUND,
              `Variant with ID ${item.variantId} not found`
            );
          }

          price = Number(variant.price);

          // Build variant name from attributes
          variantName = variant.variantAttributes
            .map((va) => va.attributeValue.value)
            .join(" / ");

          // Use variant image if available
          if (variant.imageUrl) {
            productImage = variant.imageUrl;
          }

          // Calculate discount from variant's comparePrice
          if (variant.comparePrice && Number(variant.comparePrice) > price) {
            discount = Number(variant.comparePrice) - price;
          }
        } else {
          // Calculate discount from product's comparePrice
          if (product.comparePrice && Number(product.comparePrice) > price) {
            discount = Number(product.comparePrice) - price;
          }
        }

        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        totalDiscount += discount * item.quantity;

        const orderItem: (typeof orderItemsData)[number] = {
          productId: item.productId,
          branchId: branchId,
          quantity: item.quantity,
          price,
          discount,
          total: itemTotal,
          productName: product.name,
          variantName,
          productImage
        };

        if (item.variantId) {
          orderItem.variantId = item.variantId;
        }

        orderItemsData.push(orderItem);
      }

      const totalAmount = subtotal + deliveryCharge;

      // ✅ FIX #2: Generate unique order number (uses transaction for atomic increment)
      const orderNumber = await generateOrderNumber(tx);

      // ✅ FIX #1: Reserve inventory when creating order
      const itemsToReserve = items
        .filter((item) => item.variantId)
        .map((item) => ({
          variantId: item.variantId!,
          branchId: branchId,
          quantity: item.quantity
        }));

      if (itemsToReserve.length > 0) {
        await reserveInventoryBulk(itemsToReserve, tx);
      }

      // Create order for this branch
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerPhone: payload.customerPhone,
          customerName: payload.customerName ?? null,
          customerEmail: payload.customerEmail ?? null,
          deliveryAddress: payload.deliveryAddress ?? null,
          recipientCityId: payload.recipientCityId ?? null,
          recipientZoneId: payload.recipientZoneId ?? null,
          recipientAreaId: payload.recipientAreaId ?? null,
          deliveryLocation: payload.deliveryLocation,
          deliveryCharge,
          userId: userId ?? null,
          storeId: payload.storeId,
          assignedBranchId: branchId,
          status: "PENDING",
          paymentMethod: payload.paymentMethod ?? "COD",
          subtotal,
          totalDiscount,
          totalAmount,
          items: {
            create: orderItemsData
          }
        },
        include: orderRelations.include
      });

      // ✅ Log order creation activity
      await logOrderActivity(
        tx,
        order.id,
        userId,
        "ORDER_CREATED",
        `Order created with ${items.length} items. Total: ৳${totalAmount}`
      );

      orders.push(order);
    }

    // STEP 7: Clear cart for authenticated users (for this store only)
    if (userId) {
      const userCart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (userCart) {
        const itemIdsToDelete = userCart.items
          .filter((item) => item.product.storeId === payload.storeId)
          .map((item) => item.id);

        if (itemIdsToDelete.length > 0) {
          await tx.cartItem.deleteMany({
            where: {
              id: {
                in: itemIdsToDelete
              }
            }
          });
        }
      }
    }

    // STEP 8: Return array of created orders
    return orders;
  });

  return createdOrders;
};

// GET ALL ORDERS (for admin)
const getAllOrders = async (
  filters: IOrderFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Order[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: orderSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode
        }
      }))
    });
  }

  // Filter functionality
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          equals: (filterData as any)[key]
        }
      }))
    });
  }

  const whereConditions: Prisma.OrderWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.order.findMany({
    include: orderRelations.include,
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.order.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

// GET ORDERS FOR VENDOR (only their store's orders)
const getVendorOrders = async (
  vendorId: string,
  filters: IOrderFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Order[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Only show orders for vendor's stores
  const vendorStores = await prisma.store.findMany({
    where: { vendorId, isDeleted: false },
    select: { id: true }
  });

  const storeIds = vendorStores.map((s) => s.id);

  if (storeIds.length === 0) {
    return {
      meta: {
        total: 0,
        page,
        limit
      },
      data: []
    };
  }

  andConditions.push({
    storeId: {
      in: storeIds
    }
  });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: orderSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode
        }
      }))
    });
  }

  // Filter functionality
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          equals: (filterData as any)[key]
        }
      }))
    });
  }

  const whereConditions: Prisma.OrderWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.order.findMany({
    include: orderRelations.include,
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.order.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

// GET CUSTOMER ORDERS (only their own orders)
const getCustomerOrders = async (
  userId: string,
  options: IPaginationOptions
): Promise<IGenericResponse<Order[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);

  const result = await prisma.order.findMany({
    where: { userId },
    include: orderRelations.include,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.order.count({ where: { userId } });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

// GET ORDER BY ID
const getOrderById = async (id: string): Promise<Order | null> => {
  const result = await prisma.order.findUnique({
    where: { id },
    include: orderRelations.include
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }

  return result;
};

// UPDATE ORDER (vendor can edit before confirmation)
const updateOrder = async (
  id: string,
  vendorId: string,
  payload: IUpdateOrderRequest
): Promise<Order> => {
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      store: true,
      items: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  if (!existingOrder) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }

  // Check if vendor owns this order's store
  if (existingOrder.store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this order"
    );
  }

  // Can only edit if status is PENDING
  if (existingOrder.status !== OrderStatus.PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot edit order after it has been confirmed. Only PENDING orders can be edited."
    );
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  // Update customer info
  if (payload.customerPhone !== undefined)
    updateData.customerPhone = payload.customerPhone;
  if (payload.customerName !== undefined)
    updateData.customerName = payload.customerName;
  if (payload.customerEmail !== undefined)
    updateData.customerEmail = payload.customerEmail;
  if (payload.secondaryPhone !== undefined)
    updateData.secondaryPhone = payload.secondaryPhone;
  if (payload.specialInstructions !== undefined)
    updateData.specialInstructions = payload.specialInstructions;

  // Update delivery info
  if (payload.deliveryAddress !== undefined)
    updateData.deliveryAddress = payload.deliveryAddress;
  if (payload.deliveryLocation !== undefined)
    updateData.deliveryLocation = payload.deliveryLocation;
  if (payload.recipientCityId !== undefined)
    updateData.recipientCityId = payload.recipientCityId;
  if (payload.recipientZoneId !== undefined)
    updateData.recipientZoneId = payload.recipientZoneId;
  if (payload.recipientAreaId !== undefined)
    updateData.recipientAreaId = payload.recipientAreaId;

  // Handle items update if provided
  if (payload.items && payload.items.length > 0) {
    // STEP 1: Fetch all products and variants
    const productIds = payload.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: existingOrder.storeId, // Must belong to same store
        isDeleted: false
      },
      include: {
        media: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    const variantIds = payload.items
      .map((item) => item.variantId)
      .filter((id): id is string => !!id);

    const variants =
      variantIds.length > 0
        ? await prisma.productVariant.findMany({
            where: {
              id: { in: variantIds }
            },
            include: {
              variantAttributes: {
                include: {
                  attributeValue: {
                    include: {
                      attribute: true
                    }
                  }
                }
              }
            }
          })
        : [];

    // Create maps for O(1) lookup
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // STEP 2: Calculate new totals
    let newSubtotal = 0;
    let newTotalDiscount = 0;

    const newOrderItemsData: {
      productId: string;
      variantId?: string;
      branchId: string;
      quantity: number;
      price: number;
      discount: number;
      total: number;
      productName: string;
      variantName: string | null;
      productImage: string | null;
    }[] = [];

    for (const item of payload.items) {
      // Validate product exists and belongs to store
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          `Product with ID ${item.productId} not found or does not belong to this store`
        );
      }

      let price = Number(product.basePrice);
      let comparePrice = Number(product.comparePrice || product.basePrice);
      let discount = 0;
      let variantName = null;
      let productImage = product.media[0]?.mediaUrl || null;

      // If variant is specified
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Variant with ID ${item.variantId} not found`
          );
        }

        if (variant.productId !== item.productId) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Variant does not belong to this product"
          );
        }

        price = Number(variant.price);
        comparePrice = Number(variant.comparePrice || variant.price);

        // Build variant name
        variantName = variant.variantAttributes
          .map((va) => va.attributeValue.value)
          .join(" / ");

        // Use variant image if available
        if (variant.imageUrl) {
          productImage = variant.imageUrl;
        }
      }

      // Apply price override if vendor provided one
      if (item.priceOverride !== undefined && item.priceOverride !== null) {
        price = item.priceOverride;
        // Recalculate discount based on new price
        discount = Math.max(0, comparePrice - price);
      } else {
        // Use default discount calculation
        discount = Math.max(0, comparePrice - price);
      }

      const itemTotal = price * item.quantity;
      newSubtotal += itemTotal;
      newTotalDiscount += discount * item.quantity;

      const orderItem: (typeof newOrderItemsData)[number] = {
        productId: item.productId,
        branchId: existingOrder.assignedBranchId!,
        quantity: item.quantity,
        price,
        discount,
        total: itemTotal,
        productName: product.name,
        variantName,
        productImage
      };

      if (item.variantId) {
        orderItem.variantId = item.variantId;
      }

      newOrderItemsData.push(orderItem);
    }

    // STEP 3: Calculate delivery charge
    let deliveryCharge = Number(existingOrder.deliveryCharge);

    // If delivery location changed, recalculate delivery charge
    if (payload.deliveryLocation !== undefined) {
      const chargeValue = DELIVERY_CHARGES[payload.deliveryLocation];
      if (chargeValue === undefined) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid delivery location");
      }
      deliveryCharge = chargeValue;
    }

    // Apply delivery charge override if provided
    if (
      payload.deliveryChargeOverride !== undefined &&
      payload.deliveryChargeOverride !== null
    ) {
      deliveryCharge = Number(payload.deliveryChargeOverride);
    }

    // STEP 4: Calculate new total
    const newTotalAmount = newSubtotal + deliveryCharge;

    // STEP 5: Update order with new items
    updateData.subtotal = newSubtotal;
    updateData.totalDiscount = newTotalDiscount;
    updateData.deliveryCharge = deliveryCharge;
    updateData.totalAmount = newTotalAmount;

    // Delete old items and create new ones
    updateData.items = {
      deleteMany: {}, // Delete all existing items
      create: newOrderItemsData // Create new items
    };
  } else if (payload.deliveryChargeOverride !== undefined) {
    // If only delivery charge is being overridden (no item changes)
    const newDeliveryCharge = Number(payload.deliveryChargeOverride);
    const newTotalAmount = Number(existingOrder.subtotal) + newDeliveryCharge;

    updateData.deliveryCharge = newDeliveryCharge;
    updateData.totalAmount = newTotalAmount;
  } else if (payload.deliveryLocation !== undefined) {
    // If only delivery location changed
    const chargeValue = DELIVERY_CHARGES[payload.deliveryLocation];
    if (chargeValue === undefined) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid delivery location");
    }

    const newDeliveryCharge = Number(chargeValue);
    const newTotalAmount = Number(existingOrder.subtotal) + newDeliveryCharge;

    updateData.deliveryCharge = newDeliveryCharge;
    updateData.totalAmount = newTotalAmount;
  }

  // Add edit notes if provided
  if (payload.editNotes) {
    updateData.editNotes = payload.editNotes;
  }

  // Update the order
  const result = await prisma.order.update({
    where: { id },
    data: updateData,
    include: orderRelations.include
  });

  return result;
};

// UPDATE ORDER STATUS
const updateOrderStatus = async (
  id: string,
  vendorId: string,
  payload: IUpdateOrderStatusRequest
): Promise<Order> => {
  return await prisma.$transaction(async (tx) => {
    // Fetch existing order
    const existingOrder = await tx.order.findUnique({
      where: { id },
      include: {
        store: true,
        items: true
      }
    });

    if (!existingOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    // Check if vendor owns this order's store
    if (existingOrder.store.vendorId !== vendorId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You are not authorized to update this order"
      );
    }

    // Validate status transition
    const allowedTransitions = STATUS_TRANSITIONS[existingOrder.status];
    if (!allowedTransitions || !allowedTransitions.includes(payload.status)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot transition from ${existingOrder.status} to ${payload.status}`
      );
    }

    // Block manual transition to SHIPPED unless a Pathao delivery has been booked
    if (payload.status === OrderStatus.SHIPPED) {
      const pathaoDelivery = await tx.pathaoDelivery.findUnique({
        where: { orderId: id }
      });
      if (!pathaoDelivery) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Cannot mark order as Shipped without booking a Pathao delivery first. Please book a Pathao delivery for this order."
        );
      }
    }

    // INVENTORY MANAGEMENT LOGIC

    // Prepare items for inventory operations
    const inventoryItems = existingOrder.items
      .filter((item) => item.variantId && existingOrder.assignedBranchId)
      .map((item) => ({
        variantId: item.variantId!,
        branchId: existingOrder.assignedBranchId!,
        quantity: item.quantity
      }));

    // SCENARIO 1: PENDING → CONFIRMED (Deduct actual stock)
    // Stock was already RESERVED when order was created
    // Now we need to DEDUCT from actual quantity and release from reserved
    if (
      payload.status === OrderStatus.CONFIRMED &&
      existingOrder.status === OrderStatus.PENDING
    ) {
      // Validate that order has assignedBranchId
      if (!existingOrder.assignedBranchId) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Cannot confirm order without assigned branch. Order must have an assigned branch."
        );
      }

      if (inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          const inventory = await tx.inventory.findUnique({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            }
          });

          if (!inventory) {
            throw new ApiError(
              httpStatus.NOT_FOUND,
              `Inventory not found for variant ${item.variantId}`
            );
          }

          // Check if we have enough reserved stock
          if (inventory.reservedQty < item.quantity) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Reserved stock mismatch for variant ${item.variantId}`
            );
          }

          // Deduct from actual stock AND release from reserved
          await tx.inventory.update({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            },
            data: {
              quantity: { decrement: item.quantity }, // Deduct actual stock
              reservedQty: { decrement: item.quantity } // Release from reserved
            }
          });
        }
      }
    }

    // SCENARIO 2: CONFIRMED → CANCELLED (Restore actual stock)
    // Stock was DEDUCTED when confirmed, need to restore it
    if (
      payload.status === OrderStatus.CANCELLED &&
      existingOrder.status === OrderStatus.CONFIRMED
    ) {
      if (inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          await tx.inventory.update({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            },
            data: {
              quantity: { increment: item.quantity } // Restore actual stock
            }
          });
        }
      }
    }

    // SCENARIO 3: PROCESSING/READY_FOR_PICKUP → CANCELLED (Restore actual stock)
    // Stock was already deducted, need to restore it
    if (
      payload.status === OrderStatus.CANCELLED &&
      (existingOrder.status === OrderStatus.PROCESSING ||
        existingOrder.status === OrderStatus.READY_FOR_PICKUP)
    ) {
      if (inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          await tx.inventory.update({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            },
            data: {
              quantity: { increment: item.quantity } // Restore actual stock
            }
          });
        }
      }
    }

    // SCENARIO 4: DELIVERED/OUT_FOR_DELIVERY → RETURNED (Restore actual stock)
    if (
      payload.status === OrderStatus.RETURNED &&
      (existingOrder.status === OrderStatus.DELIVERED ||
        existingOrder.status === OrderStatus.OUT_FOR_DELIVERY ||
        existingOrder.status === OrderStatus.SHIPPED)
    ) {
      if (inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          await tx.inventory.update({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            },
            data: {
              quantity: { increment: item.quantity } // Restore actual stock
            }
          });
        }
      }
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      status: payload.status
    };

    // Update order status
    const result = await tx.order.update({
      where: { id },
      data: updateData,
      include: orderRelations.include
    });

    // Log status change activity
    const activityDescription = `Order status changed from ${existingOrder.status} to ${payload.status}`;

    await logOrderActivity(
      tx,
      id,
      vendorId,
      "STATUS_CHANGED",
      activityDescription
    );

    return result;
  });
};

// ASSIGN BRANCH TO ORDER ITEM
const assignBranchToItem = async (
  orderId: string,
  itemId: string,
  vendorId: string,
  payload: IAssignBranchToItemRequest
): Promise<Order> => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, items: true }
  });

  if (!existingOrder) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }

  // Check if vendor owns this order's store
  if (existingOrder.store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this order"
    );
  }

  // Validate item belongs to order
  const item = existingOrder.items.find((i) => i.id === itemId);
  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order item not found");
  }

  // Validate branch belongs to store
  const branch = await prisma.branch.findUnique({
    where: { id: payload.branchId, isDeleted: false }
  });

  if (!branch || branch.storeId !== existingOrder.storeId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Branch does not belong to this store"
    );
  }

  // Update order item with branch assignment
  await prisma.orderItem.update({
    where: { id: itemId },
    data: { branchId: payload.branchId }
  });

  // Also update the order's assignedBranchId
  // This is needed for Pathao delivery (pickup location)
  await prisma.order.update({
    where: { id: orderId },
    data: { assignedBranchId: payload.branchId }
  });
  // Return updated order
  const result = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderRelations.include
  });

  return result!;
};

// GET ORDER FOR INVOICE (with all required data)
const getOrderForInvoice = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              weight: true
            }
          },
          variant: {
            select: {
              sku: true,
              variantAttributes: {
                include: {
                  attributeValue: {
                    include: {
                      attribute: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      store: {
        select: {
          name: true,
          logo: true,
          contactPhone: true
        }
      },
      assignedBranch: {
        select: {
          name: true,
          address: {
            select: {
              addressLine1: true,
              city: true,
              state: true,
              postalCode: true
            }
          }
        }
      },
      recipientCity: {
        select: {
          name: true
        }
      },
      recipientZone: {
        select: {
          name: true
        }
      },
      recipientArea: {
        select: {
          name: true
        }
      }
    }
  });

  return order;
};

interface ManualOrderItemPayload {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

// CREATE MANUAL ORDER (Vendor creates order on behalf of customer via phone)
const createManualOrder = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  vendorId: string
) => {
  const {
    storeId,
    customerName,
    customerPhone,
    customerEmail,
    secondaryPhone,
    specialInstructions,
    deliveryLocation,
    deliveryAddress,
    items,
    paymentMethod,
    deliveryCharge: payloadDeliveryCharge,
    recipientCityId,
    recipientZoneId,
    recipientAreaId
  } = payload;

  // 1. Verify vendor owns this store
  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!store) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  if (store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only create orders for your own store"
    );
  }

  // 2. Validate all items have variantId
  for (const item of items) {
    if (!item.variantId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Product ${item.productId} must have a variant selected`
      );
    }
  }

  // 3. Use branch assignment algorithm (same as regular createOrder)
  const cartItems = items.map((item: ManualOrderItemPayload) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    storeId
  }));

  const storeAndBranchGroups = await groupCartItemsByStoreAndBranch(cartItems);
  const branchAssignments = storeAndBranchGroups.get(storeId);

  if (!branchAssignments || branchAssignments.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No branches have sufficient stock for the requested items"
    );
  }

  // 4. Fetch all products and variants in batch (O(1) lookup)
  const productIds = items.map(
    (item: ManualOrderItemPayload) => item.productId
  );
  const variantIds = items
    .map((item: ManualOrderItemPayload) => item.variantId)
    .filter(Boolean);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId, isDeleted: false },
    include: {
      media: { where: { isPrimary: true }, take: 1 }
    }
  });

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      variantAttributes: {
        include: {
          attributeValue: {
            include: { attribute: true }
          }
        }
      }
    }
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // 5. Use vendor-provided delivery charge or fall back to default
  const deliveryCharge =
    payloadDeliveryCharge !== undefined && payloadDeliveryCharge !== null
      ? Number(payloadDeliveryCharge)
      : (DELIVERY_CHARGES[deliveryLocation as DeliveryLocation] ?? 0);

  // 6. Create orders in a transaction (one per branch)
  const createdOrders = await prisma.$transaction(async (tx) => {
    const orders = [];

    for (const branchGroup of branchAssignments) {
      const { branchId, items: branchItems } = branchGroup;

      let subtotal = 0;
      let totalDiscount = 0;
      const validatedItems = [];

      for (const branchItem of branchItems) {
        // Find the matching payload item to get unitPrice
        const payloadItem = items.find(
          (i: ManualOrderItemPayload) =>
            i.productId === branchItem.productId &&
            i.variantId === branchItem.variantId
        );

        const product = productMap.get(branchItem.productId);
        if (!product) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Product ${branchItem.productId} not found`
          );
        }

        const variant = branchItem.variantId
          ? variantMap.get(branchItem.variantId)
          : null;

        if (!variant) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Variant ${branchItem.variantId} not found`
          );
        }

        // Get comparePrice for discount calculation
        const comparePrice = Number(variant.comparePrice || variant.price);

        // Use vendor's unitPrice if provided, else fall back to variant price
        const unitPrice =
          payloadItem?.unitPrice !== undefined
            ? Number(payloadItem.unitPrice)
            : Number(variant.price);

        const discount = Math.max(0, comparePrice - unitPrice);
        const itemTotal = unitPrice * branchItem.quantity;

        subtotal += itemTotal;
        totalDiscount += discount * branchItem.quantity;

        // Build variant display name
        const variantName = variant.variantAttributes
          .map((va) => va.attributeValue.value)
          .join(" / ");

        validatedItems.push({
          productId: branchItem.productId,
          variantId: branchItem.variantId,
          branchId,
          quantity: branchItem.quantity,
          price: unitPrice,
          discount,
          total: itemTotal,
          productName: product.name,
          variantName: variantName || variant.sku || null,
          productImage: variant.imageUrl || product.media[0]?.mediaUrl || null
        });
      }

      const totalAmount = subtotal + deliveryCharge;

      // Generate order number (atomic, race-condition safe)
      const orderNumber = await generateOrderNumber(tx);

      // Reserve inventory
      // Deduct inventory immediately (manual orders are created as CONFIRMED, not PENDING)
      // So we deduct actual quantity directly — no reservation needed
      const itemsToDeduct = branchItems
        .filter((item) => item.variantId)
        .map((item) => ({
          variantId: item.variantId!,
          branchId,
          quantity: item.quantity
        }));

      if (itemsToDeduct.length > 0) {
        for (const item of itemsToDeduct) {
          const inventory = await tx.inventory.findUnique({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            }
          });

          if (!inventory) {
            throw new ApiError(
              httpStatus.NOT_FOUND,
              `Inventory not found for variant ${item.variantId} in branch ${item.branchId}`
            );
          }

          const availableQty = inventory.quantity - inventory.reservedQty;
          if (availableQty < item.quantity) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Insufficient stock for variant ${item.variantId}. Requested: ${item.quantity}, Available: ${availableQty}`
            );
          }

          // Deduct from actual quantity directly (order is already CONFIRMED)
          await tx.inventory.update({
            where: {
              variantId_branchId: {
                variantId: item.variantId,
                branchId: item.branchId
              }
            },
            data: {
              quantity: { decrement: item.quantity }
            }
          });
        }
      }

      // Create the order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerPhone,
          customerName: customerName ?? null,
          customerEmail: customerEmail ?? null,
          secondaryPhone: secondaryPhone ?? null,
          specialInstructions: specialInstructions ?? null,
          deliveryLocation: deliveryLocation as DeliveryLocation,
          deliveryAddress: deliveryAddress ?? null,
          recipientCityId: recipientCityId ?? null,
          recipientZoneId: recipientZoneId ?? null,
          recipientAreaId: recipientAreaId ?? null,
          storeId,
          assignedBranchId: branchId,
          paymentMethod: paymentMethod as PaymentMethod,
          subtotal,
          totalDiscount,
          deliveryCharge,
          totalAmount,
          status: "CONFIRMED",
          items: {
            create: validatedItems
          }
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true
            }
          },
          store: true
        }
      });

      // Log order creation activity
      await logOrderActivity(
        tx,
        order.id,
        vendorId,
        "ORDER_CREATED",
        `Manual order created with ${branchItems.length} item(s). Branch: ${branchId}. Total: ৳${totalAmount}`
      );

      orders.push(order);
    }

    return orders;
  });

  return createdOrders;
};

// CANCEL ORDER
const cancelOrder = async (
  id: string,
  userId: string,
  userRole: string, // "CUSTOMER" | "VENDOR" | "ADMIN"
  payload: ICancelOrderRequest
): Promise<Order> => {
  return await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: { id },
      include: {
        store: true,
        items: true,
        pathaoDelivery: {
          include: {
            statusHistory: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!existingOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    // Check if order can be cancelled based on current status
    if (!canCancelOrder(existingOrder.status)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot cancel order with status ${existingOrder.status}. Orders can only be cancelled when in PENDING,
CONFIRMED, PROCESSING, or READY_FOR_PICKUP status.`
      );
    }

    // Check if Pathao delivery has been requested
    if (hasPathaoDelivery(existingOrder)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot cancel order after Pathao delivery request has been sent. Please contact Pathao support to cancel the delivery."
      );
    }

    // Authorization check based on role
    if (userRole === "CUSTOMER") {
      // Customer can only cancel PENDING orders
      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Customers can only cancel orders in PENDING status. Please contact the vendor to cancel confirmed orders."
        );
      }

      // Customer can only cancel their own orders
      if (existingOrder.userId !== userId) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "You can only cancel your own orders"
        );
      }
    } else if (userRole === "VENDOR") {
      // Vendor can cancel PENDING, CONFIRMED, PROCESSING, READY_FOR_PICKUP
      // But must own the store
      if (existingOrder.store.vendorId !== userId) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "You can only cancel orders from your own store"
        );
      }
    }
    // ADMIN can cancel any order (no additional checks needed)

    // INVENTORY RESTORATION LOGIC
    if (existingOrder.assignedBranchId && existingOrder.items.length > 0) {
      const itemsWithInventory = existingOrder.items
        .filter((item) => item.variantId)
        .map((item) => ({
          variantId: item.variantId!,
          branchId: existingOrder.assignedBranchId!,
          quantity: item.quantity
        }));

      if (itemsWithInventory.length > 0) {
        if (existingOrder.status === OrderStatus.PENDING) {
          // Order was only reserved, not confirmed
          // Just release the reservation (decrease reservedQty)
          await releaseInventoryBulk(itemsWithInventory, tx);
        } else {
          // Order was CONFIRMED/PROCESSING/READY_FOR_PICKUP
          // Stock was already deducted from quantity (and reservedQty was already decreased)
          // Need to add the stock back to actual quantity
          for (const item of itemsWithInventory) {
            await tx.inventory.update({
              where: {
                variantId_branchId: {
                  variantId: item.variantId,
                  branchId: item.branchId
                }
              },
              data: {
                quantity: { increment: item.quantity } // Add stock back to actual quantity
              }
            });
          }
        }
      }
    }

    // Update order status to CANCELLED
    const result = await tx.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancellationReason: payload.reason || null,
        cancelledBy: userId,
        cancelledAt: new Date()
      },
      include: orderRelations.include
    });

    // Log cancellation activity
    const activityDescription = payload.reason
      ? `Order cancelled by ${userRole}. Reason: ${payload.reason}`
      : `Order cancelled by ${userRole}`;

    await logOrderActivity(
      tx,
      id,
      userId,
      "ORDER_CANCELLED",
      activityDescription
    );

    return result;
  });
};

export const OrderService = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  assignBranchToItem,
  getOrderForInvoice,
  createManualOrder
};
