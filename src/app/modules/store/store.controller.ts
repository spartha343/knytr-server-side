import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StoreService } from "./store.service";
import pick from "../../../shared/pick";
import { storeFilterableFields } from "./store.constants";
import ApiError from "../../../errors/ApiError";

const createStore = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.dbUser?.id;

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await StoreService.createStore(vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Store created successfully",
    data: result
  });
});

const getAllStores = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, storeFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await StoreService.getAllStores(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stores retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getMyStores = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.dbUser?.id;

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await StoreService.getMyStores(vendorId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My stores retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getStoreById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Store ID is required");
  }

  const result = await StoreService.getStoreById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Store retrieved successfully",
    data: result
  });
});

const updateStore = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Store ID is required");
  }

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await StoreService.updateStore(id, vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Store updated successfully",
    data: result
  });
});

const deleteStore = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Store ID is required");
  }

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await StoreService.deleteStore(id, vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Store deleted successfully",
    data: result
  });
});

export const StoreController = {
  createStore,
  getAllStores,
  getMyStores,
  getStoreById,
  updateStore,
  deleteStore
};
