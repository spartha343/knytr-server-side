import { z } from "zod";

const create = z.object({
  body: z.object({
    variantId: z
      .string({
        error: "Variant ID is required"
      })
      .uuid("Invalid variant ID"),
    branchId: z
      .string({
        error: "Branch ID is required"
      })
      .uuid("Invalid branch ID"),
    quantity: z
      .number({
        error: "Quantity is required"
      })
      .int("Quantity must be an integer")
      .min(0, "Quantity cannot be negative"),
    reservedQty: z.number().int().min(0).optional(),
    lowStockAlert: z.number().int().positive().optional()
  })
});

const update = z.object({
  body: z.object({
    quantity: z.number().int().min(0, "Quantity cannot be negative").optional(),
    reservedQty: z
      .number()
      .int()
      .min(0, "Reserved quantity cannot be negative")
      .optional(),
    lowStockAlert: z.number().int().positive().optional()
  })
});

const adjustStock = z.object({
  body: z.object({
    quantity: z
      .number({
        error: "Quantity is required"
      })
      .int("Quantity must be an integer"),
    reason: z.string().optional()
  })
});

const bulkCreate = z.object({
  body: z.object({
    variantId: z
      .string({
        error: "Variant ID is required"
      })
      .uuid("Invalid variant ID"),
    inventories: z
      .array(
        z.object({
          branchId: z.string().uuid("Invalid branch ID"),
          quantity: z.number().int().min(0),
          lowStockAlert: z.number().int().positive().optional()
        })
      )
      .min(1, "At least one inventory entry is required")
  })
});

export const InventoryValidation = {
  create,
  update,
  adjustStock,
  bulkCreate
};
