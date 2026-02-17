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
  IAssignBranchToItemRequest
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

// Helper: Generate unique order number
const generateOrderNumber = async (storeSlug: string): Promise<string> => {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]?.replace(/-/g, "") || "";

  // Get count of orders for this store today
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const todayOrderCount = await prisma.order.count({
    where: {
      orderNumber: {
        contains: `${storeSlug}-${dateStr}`
      },
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const sequenceNumber = String(todayOrderCount + 1).padStart(7, "0");
  return `ORD-${storeSlug}-${dateStr}-${sequenceNumber}`;
};

// CREATE ORDER (from cart or direct checkout)
const createOrder = async (
  userId: string | undefined,
  payload: ICreateOrderRequest
): Promise<Order> => {
  // Validate store exists
  const store = await prisma.store.findUnique({
    where: { id: payload.storeId, isDeleted: false }
  });

  if (!store) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  // OPTIMIZED: Batch fetch all products
  const productIds = payload.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isDeleted: false
    },
    include: {
      media: {
        where: { isPrimary: true },
        take: 1
      }
    }
  });

  // OPTIMIZED: Batch fetch all variants
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

  // Calculate totals
  let subtotal = 0;
  let totalDiscount = 0;

  const orderItemsData: {
    productId: string;
    variantId?: string;
    branchId?: string;
    quantity: number;
    price: number;
    discount: number;
    total: number;
    productName: string;
    variantName: string | null;
    productImage: string | null;
  }[] = [];

  for (const item of payload.items) {
    // Get product from map
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

      if (variant.productId !== item.productId) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Variant does not belong to this product"
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
    subtotal += price * item.quantity;
    totalDiscount += discount * item.quantity;

    const orderItem: (typeof orderItemsData)[number] = {
      productId: item.productId,
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

  // Get delivery charge
  const deliveryCharge = DELIVERY_CHARGES[payload.deliveryLocation];
  if (deliveryCharge === undefined) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid delivery location");
  }
  const totalAmount = subtotal + deliveryCharge;

  // Generate order number
  const orderNumber = await generateOrderNumber(store.slug);

  // Create order with items
  const result = await prisma.order.create({
    data: {
      orderNumber,
      customerPhone: payload.customerPhone,
      customerName: payload.customerName ?? null,
      customerEmail: payload.customerEmail ?? null,
      deliveryAddress: payload.deliveryAddress ?? null,
      deliveryLocation: payload.deliveryLocation,
      deliveryCharge,
      userId: userId ?? null,
      storeId: payload.storeId,
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

  // If user is authenticated, clear their cart for this store
  if (userId) {
    const userCart = await prisma.cart.findUnique({
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
        await prisma.cartItem.deleteMany({
          where: {
            id: {
              in: itemIdsToDelete
            }
          }
        });
      }
    }
  }

  return result;
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
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { store: true }
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

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    status: payload.status
  };

  const result = await prisma.order.update({
    where: { id },
    data: updateData,
    include: orderRelations.include
  });

  return result;
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

  // Update order item
  await prisma.orderItem.update({
    where: { id: itemId },
    data: { branchId: payload.branchId }
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
              name: true
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
      }
    }
  });

  return order;
};
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
    deliveryLocation,
    deliveryAddress,
    items,
    paymentMethod,
    deliveryCharge = 0,
    totalDiscount = 0
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

  // 2. Validate products and calculate totals
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        media: {
          where: { isPrimary: true },
          take: 1
        },
        variants: item.variantId
          ? {
              where: { id: item.variantId }
            }
          : false
      }
    });

    if (!product || product.storeId !== storeId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Product ${item.productId} not found or doesn't belong to this store`
      );
    }

    const variant = item.variantId ? product.variants[0] : null;
    const itemTotal = item.unitPrice * item.quantity;
    subtotal += itemTotal;

    validatedItems.push({
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      price: item.unitPrice,
      discount: 0,
      total: itemTotal,
      productName: product.name,
      variantName: variant?.sku || null,
      productImage: product.media[0]?.mediaUrl || null
    });
  }

  // 3. Calculate final total
  const totalAmount = subtotal - totalDiscount + deliveryCharge;

  // 4. Generate order number
  const orderCount = await prisma.order.count({
    where: {
      storeId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });

  const orderNumber = `ORD-${store.slug}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${String(orderCount + 1).padStart(6, "0")}`;

  // 5. Create order with items
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerPhone,
      customerName,
      customerEmail: customerEmail || null,
      deliveryLocation: deliveryLocation as DeliveryLocation,

      deliveryAddress: deliveryAddress || null,
      storeId,
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

  return order;
};
export const OrderService = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  assignBranchToItem,
  getOrderForInvoice,
  createManualOrder
};
