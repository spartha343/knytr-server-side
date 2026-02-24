import { z } from "zod";

const create = z.object({
  body: z
    .object({
      productId: z
        .string({
          error: "Product ID is required"
        })
        .uuid("Invalid product ID"),
      sku: z
        .string({
          error: "SKU is required"
        })
        .min(1, "SKU is required")
        .max(100, "SKU must not exceed 100 characters"),
      price: z
        .number({
          error: "Price is required"
        })
        .positive("Price must be positive"),
      comparePrice: z.number().positive().optional(),
      imageUrl: z.string().url("Invalid image URL").optional(),
      attributeValueIds: z
        .array(z.string().uuid("Invalid attribute value ID"))
        .min(1, "At least one attribute value is required")
    })
    .refine((data) => !data.comparePrice || data.comparePrice > data.price, {
      message: "Compare price must be greater than variant price",
      path: ["comparePrice"]
    })
});

const update = z.object({
  body: z
    .object({
      sku: z.string().min(1).max(100).optional(),
      price: z.number().positive("Price must be positive").optional(),
      comparePrice: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
      }, z.number().positive().nullable().optional()),
      imageUrl: z.string().url("Invalid image URL").nullable().optional(),
      isActive: z.boolean().optional()
    })
    .refine(
      (data) =>
        !data.comparePrice || !data.price || data.comparePrice > data.price,
      {
        message: "Compare price must be greater than variant price",
        path: ["comparePrice"]
      }
    )
});

const bulkCreate = z.object({
  body: z.object({
    productId: z
      .string({
        error: "Product ID is required"
      })
      .uuid("Invalid product ID"),
    variants: z
      .array(
        z
          .object({
            sku: z.string().min(1).max(100),
            price: z.number().positive(),
            comparePrice: z.number().positive().optional(),
            imageUrl: z.string().url().optional(),
            attributeValueIds: z.array(z.string().uuid()).min(1)
          })
          .refine(
            (data) => !data.comparePrice || data.comparePrice > data.price,
            {
              message: "Compare price must be greater than variant price",
              path: ["comparePrice"]
            }
          )
      )
      .min(1, "At least one variant is required")
  })
});

export const ProductVariantValidation = {
  create,
  update,
  bulkCreate
};
