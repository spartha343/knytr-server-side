import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ProductVariantService } from "./productVariant.service";
import ApiError from "../../../errors/ApiError";

const createProductVariant = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductVariantService.createProductVariant(
    userId,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product variant created successfully",
    data: result
  });
});

const bulkCreateProductVariants = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.dbUser?.id;

    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
    }

    const result = await ProductVariantService.bulkCreateProductVariants(
      userId,
      req.body
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: `${result.length} product variants created successfully`,
      data: result
    });
  }
);

const getProductVariants = catchAsync(async (req: Request, res: Response) => {
  const { productId } = req.params;

  if (!productId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
  }

  const result = await ProductVariantService.getProductVariants(productId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product variants retrieved successfully",
    data: result
  });
});

const getVariantById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Variant ID is required");
  }

  const result = await ProductVariantService.getVariantById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product variant retrieved successfully",
    data: result
  });
});

const updateProductVariant = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Variant ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductVariantService.updateProductVariant(
    id,
    userId,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product variant updated successfully",
    data: result
  });
});

const deleteProductVariant = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.dbUser?.id;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Variant ID is required");
  }

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ProductVariantService.deleteProductVariant(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product variant deleted successfully",
    data: result
  });
});

export const ProductVariantController = {
  createProductVariant,
  bulkCreateProductVariants,
  getProductVariants,
  getVariantById,
  updateProductVariant,
  deleteProductVariant
};
