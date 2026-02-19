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

  // Calculate final quantity that will be in cart
  const finalQuantity = existingItem
    ? existingItem.quantity + quantity
    : quantity;

  // Validate inventory availability (only for variants)
  if (variantId) {
    const variantWithInventory = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        inventories: {
          select: {
            quantity: true,
            reservedQty: true
          }
        }
      }
    });

    if (
      !variantWithInventory ||
      variantWithInventory.inventories.length === 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This product variant is out of stock"
      );
    }

    // Calculate total available stock across all branches
    const totalAvailable = variantWithInventory.inventories.reduce(
      (sum, inv) => sum + (inv.quantity - inv.reservedQty),
      0
    );

    if (totalAvailable <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This product is out of stock"
      );
    }

    // Check if final quantity exceeds available stock
    if (finalQuantity > totalAvailable) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient stock. Only ${totalAvailable} units available${
          existingItem
            ? `, but you already have
${existingItem.quantity} in cart and are trying to add ${quantity} more`
            : ""
        }`
      );
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
      cart: true,
      variant: {
        include: {
          inventories: {
            select: {
              quantity: true,
              reservedQty: true
            }
          }
        }
      }
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

  // Validate inventory availability (only for items with variants)
  if (cartItem.variantId && cartItem.variant) {
    if (
      !cartItem.variant.inventories ||
      cartItem.variant.inventories.length === 0
    ) {
      // No inventory - remove from cart
      await prisma.cartItem.delete({
        where: { id: itemId }
      });

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This product variant is out of stock and has been removed from your cart"
      );
    }

    // Calculate total available stock across all branches
    const totalAvailable = cartItem.variant.inventories.reduce(
      (sum, inv) => sum + (inv.quantity - inv.reservedQty),
      0
    );

    if (totalAvailable <= 0) {
      // Out of stock - remove from cart
      await prisma.cartItem.delete({
        where: { id: itemId }
      });

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This product is out of stock and has been removed from your cart"
      );
    }

    // Check if requested quantity exceeds available stock
    if (quantity > totalAvailable) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient stock. Only ${totalAvailable} units available`
      );
    }
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

  // Track adjusted items for notification
  const adjustedItems: {
    productName: string;
    requestedQty: number;
    adjustedQty: number;
  }[] = [];
  const skippedItems: { productName: string; reason: string }[] = [];

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
      skippedItems.push({
        productName: "Unknown Product",
        reason: "Product not found"
      });
      continue;
    }

    // If variantId provided, validate it and check inventory
    let finalQuantity = quantity;
    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId: productId
        },
        include: {
          inventories: {
            select: {
              quantity: true,
              reservedQty: true
            }
          }
        }
      });

      if (!variant) {
        skippedItems.push({
          productName: product.name,
          reason: "Variant not found"
        });
        continue;
      }

      // Check inventory availability
      if (!variant.inventories || variant.inventories.length === 0) {
        skippedItems.push({
          productName: product.name,
          reason: "Out of stock"
        });
        continue;
      }

      // Calculate total available stock
      const totalAvailable = variant.inventories.reduce(
        (sum, inv) => sum + (inv.quantity - inv.reservedQty),
        0
      );

      if (totalAvailable <= 0) {
        skippedItems.push({
          productName: product.name,
          reason: "Out of stock"
        });
        continue;
      }

      // Check if item already exists in DB cart
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
          variantId: variantId || null
        }
      });

      // Calculate what the final quantity would be
      const wouldBeQuantity = existingItem
        ? existingItem.quantity + quantity
        : quantity;

      // Auto-adjust if exceeds available stock
      if (wouldBeQuantity > totalAvailable) {
        finalQuantity = existingItem
          ? Math.max(0, totalAvailable - existingItem.quantity)
          : totalAvailable;

        if (finalQuantity <= 0) {
          // Can't add any more - user already has max or more in cart
          skippedItems.push({
            productName: product.name,
            reason: `Already have maximum available (${totalAvailable}) in cart`
          });
          continue;
        }

        adjustedItems.push({
          productName: product.name,
          requestedQty: quantity,
          adjustedQty: finalQuantity
        });
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
      // Update quantity (add adjusted quantity)
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + finalQuantity
        }
      });
    } else {
      // Create new cart item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity: finalQuantity,
          priceSnapshot
        }
      });
    }
  }

  // Return merged cart with adjustment info
  const mergedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    ...cartRelations
  });

  return {
    cart: mergedCart,
    adjustments: adjustedItems,
    skipped: skippedItems
  };
};

export const CartService = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart
};
