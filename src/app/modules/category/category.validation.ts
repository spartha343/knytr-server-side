import { z } from "zod";

const create = z.object({
  body: z.object({
    name: z
      .string({
        error: "Category name is required"
      })
      .min(2, "Category name must be at least 2 characters")
      .max(100, "Category name must not exceed 100 characters"),
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
    parentId: z.string().uuid("Invalid parent category ID").optional(),
    seoTitle: z
      .string()
      .max(150, "SEO title must not exceed 150 characters")
      .optional(),
    seoDescription: z
      .string()
      .max(300, "SEO description must not exceed 300 characters")
      .optional(),
    seoKeywords: z.string().optional()
  })
});

const update = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Category name must be at least 2 characters")
      .max(100, "Category name must not exceed 100 characters")
      .optional(),
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .nullable()
      .optional(),
    imageUrl: z.string().url("Invalid image URL").nullable().optional(),
    parentId: z
      .string()
      .uuid("Invalid parent category ID")
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    seoTitle: z
      .string()
      .max(150, "SEO title must not exceed 150 characters")
      .nullable()
      .optional(),
    seoDescription: z
      .string()
      .max(300, "SEO description must not exceed 300 characters")
      .nullable()
      .optional(),
    seoKeywords: z.string().nullable().optional()
  })
});

export const CategoryValidation = {
  create,
  update
};
