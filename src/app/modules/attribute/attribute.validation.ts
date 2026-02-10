import { z } from "zod";

const createAttribute = z.object({
  body: z.object({
    name: z
      .string({
        error: "Attribute name is required"
      })
      .min(2, "Attribute name must be at least 2 characters")
      .max(50, "Attribute name must not exceed 50 characters"),
    displayName: z.string().max(100).optional(),
    type: z.enum(["text", "color", "image"]).optional()
  })
});

const updateAttribute = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Attribute name must be at least 2 characters")
      .max(50, "Attribute name must not exceed 50 characters")
      .optional(),
    displayName: z.string().max(100).nullable().optional(),
    type: z.enum(["text", "color", "image"]).optional(),
    isActive: z.boolean().optional()
  })
});

const createAttributeValue = z.object({
  body: z.object({
    attributeId: z
      .string({
        error: "Attribute ID is required"
      })
      .uuid("Invalid attribute ID"),
    value: z
      .string({
        error: "Value is required"
      })
      .min(1, "Value must be at least 1 character")
      .max(100, "Value must not exceed 100 characters"),
    colorCode: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .optional(),
    imageUrl: z.string().url("Invalid image URL").optional()
  })
});

const updateAttributeValue = z.object({
  body: z.object({
    value: z
      .string()
      .min(1, "Value must be at least 1 character")
      .max(100, "Value must not exceed 100 characters")
      .optional(),
    colorCode: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .nullable()
      .optional(),
    imageUrl: z.string().url("Invalid image URL").nullable().optional()
  })
});

export const AttributeValidation = {
  createAttribute,
  updateAttribute,
  createAttributeValue,
  updateAttributeValue
};
