import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ProductService } from "./product.service";
import pick from "../../../shared/pick";
import { productFilterableFields } from "./product.constants";
import ApiError from "../../../errors/ApiError";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductService.createProduct(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: result
  });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, productFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ProductService.getAllProducts(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  const result = await ProductService.getProductById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductService.updateProduct(id, userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product updated successfully",
    data: result
  });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductService.deleteProduct(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product deleted successfully",
    data: result
  });
});

const getSimilarProducts = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  const result = await ProductService.getSimilarProducts(id, limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Similar products retrieved successfully",
    data: result
  });
});

export const ProductController = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getSimilarProducts
};
