import { z } from "zod";

const create = z.object({
  body: z.object({
    name: z
      .string({
        error: "Brand name is required"
      })
      .min(2, "Brand name must be at least 2 characters")
      .max(100, "Brand name must not exceed 100 characters"),
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .optional(),
    logoUrl: z.string().url("Invalid logo URL").optional(),
    websiteUrl: z.string().url("Invalid website URL").optional(),
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
      .min(2, "Brand name must be at least 2 characters")
      .max(100, "Brand name must not exceed 100 characters")
      .optional(),
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .nullable()
      .optional(),
    logoUrl: z.string().url("Invalid logo URL").nullable().optional(),
    websiteUrl: z.string().url("Invalid website URL").nullable().optional(),
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

export const BrandValidation = {
  create,
  update
};
