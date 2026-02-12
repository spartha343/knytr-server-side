import { z } from "zod";

const addToCart = z.object({
  body: z.object({
    productId: z.string({
      error: "Product ID is required"
    }),
    variantId: z.string().optional(),
    quantity: z
      .number({
        error: "Quantity is required"
      })
      .int()
      .min(1, "Quantity must be at least 1")
  })
});

const updateCartItem = z.object({
  body: z.object({
    quantity: z
      .number({
        error: "Quantity is required"
      })
      .int()
      .min(1, "Quantity must be at least 1")
  })
});

const syncCart = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string({
          error: "Product ID is required"
        }),
        variantId: z.string().optional(),
        quantity: z
          .number({
            error: "Quantity is required"
          })
          .int()
          .min(1, "Quantity must be at least 1"),
        priceSnapshot: z.number({
          error: "Price snapshot is required"
        })
      })
    )
  })
});

export const CartValidation = {
  addToCart,
  updateCartItem,
  syncCart
};
