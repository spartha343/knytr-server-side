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

// Get public stores (only active, not deleted)
const getPublicStores = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, storeFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  // Force only active stores for public
  const publicFilters = {
    ...filters,
    isActive: true
  };

  const result = await StoreService.getAllStores(publicFilters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stores retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

// Get public store by ID or slug
const getPublicStoreByIdOrSlug = catchAsync(
  async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;

    if (!idOrSlug) {
      throw new ApiError(httpStatus.BAD_REQUEST, "id or slug is required!");
    }

    const result = await StoreService.getPublicStoreByIdOrSlug(idOrSlug);

    if (!result) {
      throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
    }

    // Check if active
    if (!result.isActive || result.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Store not available");
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Store retrieved successfully",
      data: result
    });
  }
);

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
  getPublicStores,
  getPublicStoreByIdOrSlug,
  getMyStores,
  updateStore,
  deleteStore
};
