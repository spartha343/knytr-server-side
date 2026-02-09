import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { BranchService } from "./branch.service";
import pick from "../../../shared/pick";
import { branchFilterableFields } from "./branch.constants";
import ApiError from "../../../errors/ApiError";

const createBranch = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.dbUser?.id;

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await BranchService.createBranch(vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Branch created successfully",
    data: result
  });
});

const getAllBranches = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, branchFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await BranchService.getAllBranches(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Branches retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getBranchesByStore = catchAsync(async (req: Request, res: Response) => {
  const { storeId } = req.params;

  if (!storeId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Store ID is required");
  }

  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await BranchService.getBranchesByStore(storeId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Store branches retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getBranchById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  const result = await BranchService.getBranchById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Branch retrieved successfully",
    data: result
  });
});

const updateBranch = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await BranchService.updateBranch(id, vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Branch updated successfully",
    data: result
  });
});

const deleteBranch = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendorId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  if (!vendorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await BranchService.deleteBranch(id, vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Branch deleted successfully",
    data: result
  });
});

export const BranchController = {
  createBranch,
  getAllBranches,
  getBranchesByStore,
  getBranchById,
  updateBranch,
  deleteBranch
};
