import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { OrderService } from "./order.service";
import pick from "../../../shared/pick";
import { orderFilterableFields } from "./order.constants";
import ApiError from "../../../errors/ApiError";

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

export const OrderController = {
  createOrder,
  getAllOrders,
  getVendorOrders,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  assignBranchToItem
};
