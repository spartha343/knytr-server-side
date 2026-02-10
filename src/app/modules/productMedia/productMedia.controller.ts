import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ProductMediaService } from "./productMedia.service";
import ApiError from "../../../errors/ApiError";

const uploadProductMedia = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductMediaService.uploadProductMedia(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product media uploaded successfully",
    data: result
  });
});

const setPrimaryMedia = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Media ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductMediaService.setPrimaryMedia(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Primary media updated successfully",
    data: result
  });
});

const deleteProductMedia = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Media ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductMediaService.deleteProductMedia(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product media deleted successfully",
    data: result
  });
});

const getProductMedia = catchAsync(async (req: Request, res: Response) => {
  const { productId } = req.params;

  if (!productId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  const result = await ProductMediaService.getProductMedia(productId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product media retrieved successfully",
    data: result
  });
});

export const ProductMediaController = {
  uploadProductMedia,
  setPrimaryMedia,
  deleteProductMedia,
  getProductMedia
};
