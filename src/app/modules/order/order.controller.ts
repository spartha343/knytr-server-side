import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { OrderService } from "./order.service";
import pick from "../../../shared/pick";
import { orderFilterableFields } from "./order.constants";
import ApiError from "../../../errors/ApiError";
import invoiceService from "./invoice.service";

// CREATE ORDER
const createOrder = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id; // Can be undefined for guest checkout
  const result = await OrderService.createOrder(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result
  });
});

// GET ALL ORDERS (Admin only)
const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, orderFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await OrderService.getAllOrders(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders fetched successfully",
    meta: result.meta,
    data: result.data
  });
});

// GET VENDOR ORDERS (Vendor only - their store's orders)
const getVendorOrders = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.dbUser!.id;
  const filters = pick(req.query, orderFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await OrderService.getVendorOrders(vendorId, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders fetched successfully",
    meta: result.meta,
    data: result.data
  });
});

// GET CUSTOMER ORDERS (Customer only - their own orders)
const getCustomerOrders = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id;
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await OrderService.getCustomerOrders(userId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders fetched successfully",
    meta: result.meta,
    data: result.data
  });
});

// GET ORDER BY ID
const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "id is required");
  }

  const result = await OrderService.getOrderById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order fetched successfully",
    data: result
  });
});

// UPDATE ORDER (Vendor only - before voice confirmation)
const updateOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser!.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "id is required");
  }

  const result = await OrderService.updateOrder(id, vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order updated successfully",
    data: result
  });
});

// UPDATE ORDER STATUS (Vendor only)
const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser!.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "id is required");
  }

  const result = await OrderService.updateOrderStatus(id, vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order status updated successfully",
    data: result
  });
});

// ASSIGN BRANCH TO ORDER ITEM (Vendor only)
const assignBranchToItem = catchAsync(async (req: Request, res: Response) => {
  const { orderId, itemId } = req.params;
  const vendorId = req.dbUser!.id;
  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "order id is required");
  }
  if (!itemId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "item id is required");
  }
  const result = await OrderService.assignBranchToItem(
    orderId,
    itemId,
    vendorId,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Branch assigned to order item successfully",
    data: result
  });
});

// GENERATE INVOICE PDF
const generateInvoice = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const dbUser = req.dbUser;

  if (!dbUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "id is required");
  }

  // Get order with all invoice data
  const order = await OrderService.getOrderForInvoice(id);

  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }

  // Check authorization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRoles = dbUser.userRoles.map((ur: any) => ur.role.name);
  const isCustomer = order.userId === dbUser.id;
  const isVendor = userRoles.includes("VENDOR");
  const isAdmin = userRoles.includes("ADMIN");

  if (!isCustomer && !isVendor && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  // Transform order data to match InvoiceData interface
  const invoiceData = {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customerName: order.customerName || "Guest Customer",
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress || "",
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.status === "DELIVERED" ? "PAID" : "PENDING",
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryCharge),
    totalAmount: Number(order.totalAmount),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderItems: order.items.map((item: any) => ({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      product: {
        name: item.product.name
      },
      variant: item.variant
        ? {
            sku: item.variant.sku,
            variantAttributes: item.variant.variantAttributes
          }
        : null
    })),
    store: {
      name: order.store.name,
      logo: order.store.logo,
      contactPhone: order.store.contactPhone
    },
    branch: order.assignedBranch
      ? {
          name: order.assignedBranch.name,
          address: order.assignedBranch.address
            ? {
                street: order.assignedBranch.address.addressLine1,
                city: order.assignedBranch.address.city,
                state: order.assignedBranch.address.state || "",
                postalCode: order.assignedBranch.address.postalCode
              }
            : null
        }
      : null
  };

  // Generate invoice PDF
  const pdfBuffer = await invoiceService.generateInvoice(invoiceData);

  // Send PDF as downloadable file
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${order.orderNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

const createManualOrder = catchAsync(async (req: Request, res: Response) => {
  const dbUser = req.dbUser;

  if (!dbUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  // Verify user is a vendor
  const isVendor = dbUser.userRoles.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ur: any) => ur.role.name === "VENDOR"
  );

  if (!isVendor) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only vendors can create manual orders"
    );
  }

  const result = await OrderService.createManualOrder(req.body, dbUser.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Manual order created successfully",
    data: result
  });
});

export const OrderController = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  assignBranchToItem,
  generateInvoice,
  createManualOrder
};
