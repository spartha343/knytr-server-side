import httpStatus from "http-status";
import ApiError from "../../../errors/ApiError";
import { cartRelations } from "./cart.constants";

import { prisma } from "../../../shared/prisma";
import type {
  IAddToCartPayload,
  ISyncCartPayload,
  IUpdateCartItemPayload
} from "./cart.interface";

const addToCart = async (userId: string, payload: IAddToCartPayload) => {
  const { productId, variantId, quantity } = payload;

  // Validate product exists and is not deleted
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isDeleted: false
    }
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // If variantId provided, validate it exists and belongs to this product
  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId: productId
      }
    });

    if (!variant) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
    }
  }

  // Determine price snapshot
  let priceSnapshot = Number(product.basePrice);

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });
    if (variant && variant.price !== null) {
      priceSnapshot = Number(variant.price);
    }
  }

  // Get or create cart for user
  let cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId }
    });
  }

  // Check if item already exists in cart
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
      variantId: variantId || null
    }
  });

  if (existingItem) {
    // Update quantity
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + quantity,
        priceSnapshot // Update price snapshot
      }
    });
  } else {
    // Create new cart item
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity,
        priceSnapshot
      }
    });
  }

  // Return updated cart with items
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    ...cartRelations
  });

  return updatedCart;
};

const getCart = async (userId: string) => {
  // Get or create cart for user (user already verified by checkDBUser middleware)
  let cart = await prisma.cart.findUnique({
    where: { userId },
    ...cartRelations
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      ...cartRelations
    });
  }

  return cart;
};

const updateCartItem = async (
  userId: string,
  itemId: string,
  payload: IUpdateCartItemPayload
) => {
  const { quantity } = payload;

  // Find cart item and verify ownership
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      cart: true
    }
  });

  if (!cartItem) {
    throw new ApiError(httpStatus.NOT_FOUND, "Cart item not found");
  }

  if (cartItem.cart.userId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You do not have permission to update this cart item"
    );
  }

  // Update quantity
  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity }
  });

  // Return updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartItem.cartId },
    ...cartRelations
  });

  return updatedCart;
};

const removeCartItem = async (userId: string, itemId: string) => {
  // Find cart item and verify ownership
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      cart: true
    }
  });

  if (!cartItem) {
    throw new ApiError(httpStatus.NOT_FOUND, "Cart item not found");
  }

  if (cartItem.cart.userId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You do not have permission to remove this cart item"
    );
  }

  // Delete cart item
  await prisma.cartItem.delete({
    where: { id: itemId }
  });

  // Return updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartItem.cartId },
    ...cartRelations
  });

  return updatedCart;
};

const clearCart = async (userId: string) => {
  // Get user's cart
  const cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    throw new ApiError(httpStatus.NOT_FOUND, "Cart not found");
  }

  // Delete all cart items
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id }
  });

  // Return empty cart
  const emptyCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    ...cartRelations
  });

  return emptyCart;
};

const syncCart = async (userId: string, payload: ISyncCartPayload) => {
  const { items } = payload;

  // Get or create cart for user (user already verified by checkDBUser middleware)
  let cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId }
    });
  }

  // Process each item from guest cart
  for (const item of items) {
    const { productId, variantId, quantity, priceSnapshot } = item;

    // Validate product exists
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isDeleted: false
      }
    });

    if (!product) {
      // Skip invalid products
      continue;
    }

    // If variantId provided, validate it
    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId: productId
        }
      });

      if (!variant) {
        // Skip invalid variants
        continue;
      }
    }

    // Check if item already exists in DB cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null
      }
    });

    if (existingItem) {
      // Update quantity (add quantities together)
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity
        }
      });
    } else {
      // Create new cart item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          priceSnapshot
        }
      });
    }
  }

  // Return merged cart
  const mergedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    ...cartRelations
  });

  return mergedCart;
};

export const CartService = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart
};
