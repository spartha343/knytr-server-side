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
import type { Prisma, Order } from "../../../generated/prisma/client";
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
      policeStation: payload.policeStation ?? null,
      deliveryDistrict: payload.deliveryDistrict ?? null,
      deliveryArea: payload.deliveryArea ?? null,
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
      AND: Object.keys(filterData).map((key) => {
        // Handle boolean fields
        if (key === "isVoiceConfirmed") {
          return {
            [key]:
              filterData[key as keyof typeof filterData] === "true" ||
              filterData[key as keyof typeof filterData] === true
          };
        }
        return {
          [key]: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            equals: (filterData as any)[key]
          }
        };
      })
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
      AND: Object.keys(filterData).map((key) => {
        if (key === "isVoiceConfirmed") {
          return {
            [key]:
              filterData[key as keyof typeof filterData] === "true" ||
              filterData[key as keyof typeof filterData] === true
          };
        }
        return {
          [key]: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            equals: (filterData as any)[key]
          }
        };
      })
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

// UPDATE ORDER (vendor can edit before voice confirmation)
const updateOrder = async (
  id: string,
  vendorId: string,
  payload: IUpdateOrderRequest
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

  // Can only edit if not yet voice confirmed
  if (existingOrder.isVoiceConfirmed) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot edit order after voice confirmation"
    );
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    isEditedByVendor: true,
    editedAt: new Date()
  };

  if (payload.customerPhone !== undefined)
    updateData.customerPhone = payload.customerPhone;
  if (payload.customerName !== undefined)
    updateData.customerName = payload.customerName;
  if (payload.customerEmail !== undefined)
    updateData.customerEmail = payload.customerEmail;
  if (payload.policeStation !== undefined)
    updateData.policeStation = payload.policeStation;
  if (payload.deliveryDistrict !== undefined)
    updateData.deliveryDistrict = payload.deliveryDistrict;
  if (payload.deliveryArea !== undefined)
    updateData.deliveryArea = payload.deliveryArea;
  if (payload.deliveryAddress !== undefined)
    updateData.deliveryAddress = payload.deliveryAddress;
  if (payload.editNotes !== undefined) updateData.editNotes = payload.editNotes;

  // If delivery location changes, update delivery charge
  if (payload.deliveryLocation !== undefined) {
    updateData.deliveryLocation = payload.deliveryLocation;
    const newDeliveryCharge = DELIVERY_CHARGES[payload.deliveryLocation];
    if (newDeliveryCharge === undefined) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid delivery location");
    }
    updateData.deliveryCharge = newDeliveryCharge;
    updateData.deliveryCharge = newDeliveryCharge;
    // Recalculate total
    updateData.totalAmount =
      Number(existingOrder.subtotal) -
      Number(existingOrder.totalDiscount) +
      newDeliveryCharge;
  }

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

  if (payload.editNotes) {
    updateData.editNotes = payload.editNotes;
  }

  // If transitioning to CONFIRMED, set voice confirmation fields
  if (payload.status === "CONFIRMED") {
    updateData.isVoiceConfirmed = true;
    updateData.voiceConfirmedAt = new Date();
    updateData.voiceConfirmedBy = vendorId;
  }

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

export const OrderService = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  assignBranchToItem
};
