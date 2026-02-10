import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { InventoryService } from "./inventory.service";
import ApiError from "../../../errors/ApiError";

const createInventory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await InventoryService.createInventory(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Inventory created successfully",
    data: result
  });
});

const bulkCreateInventory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await InventoryService.bulkCreateInventory(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `${result.length} inventory records created successfully`,
    data: result
  });
});

const getInventoryByVariant = catchAsync(
  async (req: Request, res: Response) => {
    const { variantId } = req.params;

    if (!variantId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Variant ID is required");
    }

    const result = await InventoryService.getInventoryByVariant(variantId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Inventory retrieved successfully",
      data: result
    });
  }
);

const getInventoryByBranch = catchAsync(async (req: Request, res: Response) => {
  const { branchId } = req.params;

  if (!branchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  const result = await InventoryService.getInventoryByBranch(branchId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inventory retrieved successfully",
    data: result
  });
});

const getLowStockItems = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await InventoryService.getLowStockItems(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Low stock items retrieved successfully",
    data: result
  });
});

const updateInventory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Inventory ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await InventoryService.updateInventory(id, userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inventory updated successfully",
    data: result
  });
});

const adjustStock = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Inventory ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await InventoryService.adjustStock(id, userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stock adjusted successfully",
    data: result
  });
});

export const InventoryController = {
  createInventory,
  bulkCreateInventory,
  getInventoryByVariant,
  getInventoryByBranch,
  getLowStockItems,
  updateInventory,
  adjustStock
};
