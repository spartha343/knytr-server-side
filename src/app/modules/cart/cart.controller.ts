import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { CartService } from "./cart.service";
import ApiError from "../../../errors/ApiError";

const addToCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const result = await CartService.addToCart(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Item added to cart successfully",
    data: result
  });
});

const getCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const result = await CartService.getCart(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart retrieved successfully",
    data: result
  });
});

const updateCartItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const { itemId } = req.params;
  if (!itemId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "item id is required !");
  }
  const result = await CartService.updateCartItem(userId, itemId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart item updated successfully",
    data: result
  });
});

const removeCartItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const { itemId } = req.params;
  if (!itemId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "item id is required !");
  }
  const result = await CartService.removeCartItem(userId, itemId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart item removed successfully",
    data: result
  });
});

const clearCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const result = await CartService.clearCart(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart cleared successfully",
    data: result
  });
});

const syncCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser!.id; // Use database user ID
  const result = await CartService.syncCart(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart synced successfully",
    data: result
  });
});

export const CartController = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart
};
