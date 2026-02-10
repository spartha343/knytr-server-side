import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { BrandService } from "./brand.service";
import pick from "../../../shared/pick";
import { brandFilterableFields } from "./brand.constants";
import ApiError from "../../../errors/ApiError";

const createBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.createBrand(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Brand created successfully",
    data: result
  });
});

const getAllBrands = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, brandFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await BrandService.getAllBrands(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brands retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getBrandById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Brand ID is required");
  }

  const result = await BrandService.getBrandById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand retrieved successfully",
    data: result
  });
});

const updateBrand = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Brand ID is required");
  }

  const result = await BrandService.updateBrand(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand updated successfully",
    data: result
  });
});

const deleteBrand = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Brand ID is required");
  }

  const result = await BrandService.deleteBrand(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Brand deleted successfully",
    data: result
  });
});

export const BrandController = {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand
};
