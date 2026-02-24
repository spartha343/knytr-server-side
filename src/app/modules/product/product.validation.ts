import { z } from "zod";

const create = z.object({
  body: z
    .object({
      name: z
        .string({
          error: "Product name is required"
        })
        .min(3, "Product name must be at least 3 characters")
        .max(200, "Product name must not exceed 200 characters"),
      description: z.string().optional(),
      basePrice: z
        .number({
          error: "Base price is required"
        })
        .positive("Base price must be positive"),
      comparePrice: z.number().positive().optional(),
      categoryId: z.uuid({ message: "Invalid category ID" }),
      brandId: z.uuid("Invalid brand ID").optional(),
      storeId: z
        .string({
          error: "Store is required"
        })
        .uuid("Invalid store ID"),
      seoTitle: z.string().max(150).optional(),
      seoDescription: z.string().max(300).optional(),
      seoKeywords: z.string().optional(),
      weight: z.number().positive().optional(),
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      freeShipping: z.boolean().optional(),
      attributeIds: z.array(z.string().uuid()).optional()
    })
    .refine(
      (data) => !data.comparePrice || data.comparePrice > data.basePrice,
      {
        message: "Compare price must be greater than base price",
        path: ["comparePrice"]
      }
    )
});

const update = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(3, "Product name must be at least 3 characters")
        .max(200, "Product name must not exceed 200 characters")
        .optional(),
      description: z.string().nullable().optional(),
      basePrice: z.number().positive("Base price must be positive").optional(),
      comparePrice: z.number().positive().nullable().optional(),
      categoryId: z.uuid("Invalid category ID").optional(),
      brandId: z.string().uuid("Invalid brand ID").optional(),
      isActive: z.boolean().optional(),
      isPublished: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      seoTitle: z.string().max(150).nullable().optional(),
      seoDescription: z.string().max(300).nullable().optional(),
      seoKeywords: z.string().nullable().optional(),
      weight: z.number().positive().nullable().optional(),
      length: z.number().positive().nullable().optional(),
      width: z.number().positive().nullable().optional(),
      height: z.number().positive().nullable().optional(),
      attributeIds: z.array(z.uuid()).optional(),
      freeShipping: z.boolean().optional()
    })
    .refine(
      (data) =>
        !data.comparePrice ||
        !data.basePrice ||
        data.comparePrice > data.basePrice,
      {
        message: "Compare price must be greater than base price",
        path: ["comparePrice"]
      }
    )
});

export const ProductValidation = {
  create,
  update
};
