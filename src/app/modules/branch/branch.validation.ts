import { z } from "zod";

const addressSchema = z.object({
  addressLine1: z.string({
    error: "Address line 1 is required"
  }),
  addressLine2: z.string().optional(),
  city: z.string({
    error: "City is required"
  }),
  state: z.string().optional(),
  postalCode: z.string({
    error: "Postal code is required"
  }),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

const create = z.object({
  body: z.object({
    name: z
      .string({
        error: "Branch name is required"
      })
      .min(3, "Branch name must be at least 3 characters"),
    storeId: z.string({
      error: "Store ID is required"
    }),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    address: addressSchema
  })
});

const update = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    isActive: z.boolean().optional(),
    address: addressSchema.partial().optional()
  })
});

export const BranchValidation = {
  create,
  update
};
