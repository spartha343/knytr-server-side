import { z } from "zod";

const create = z.object({
  body: z.object({
    name: z
      .string({
        error: "Store name is required"
      })
      .min(3, "Store name must be at least 3 characters"),
    description: z.string().optional(),
    logo: z.string().url().optional(),
    banner: z.string().url().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.string().optional(),
    // Contact fields (NEW)
    whatsappNumber: z
      .string()
      .regex(
        /^(\+8801|01)[3-9]\d{8}$/,
        "Invalid Bangladesh phone number format"
      )
      .optional()
      .or(z.literal("")),
    messengerLink: z
      .string()
      .url("Invalid Messenger link")
      .optional()
      .or(z.literal("")),
    contactPhone: z
      .string()
      .regex(
        /^(\+8801|01)[3-9]\d{8}$/,
        "Invalid Bangladesh phone number format"
      )
      .optional()
      .or(z.literal(""))
  })
});

const update = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    description: z.string().optional(),
    logo: z.string().url().optional(),
    banner: z.string().url().optional(),
    isActive: z.boolean().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.string().optional(),
    // Contact fields (NEW)
    whatsappNumber: z
      .string()
      .regex(
        /^(\+8801|01)[3-9]\d{8}$/,
        "Invalid Bangladesh phone number format"
      )
      .optional()
      .or(z.literal("")),
    messengerLink: z
      .string()
      .url("Invalid Messenger link")
      .optional()
      .or(z.literal("")),
    contactPhone: z
      .string()
      .regex(
        /^(\+8801|01)[3-9]\d{8}$/,
        "Invalid Bangladesh phone number format"
      )
      .optional()
      .or(z.literal(""))
  })
});

export const StoreValidation = {
  create,
  update
};
