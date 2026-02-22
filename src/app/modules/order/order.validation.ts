import { z } from "zod";
import {
  DeliveryLocation,
  OrderStatus,
  PaymentMethod
} from "../../../generated/prisma/client";

const createOrderZodSchema = z.object({
  body: z.object({
    customerPhone: z
      .string({ error: "Customer phone is required" })
      .length(11, "Phone number must be exactly 11 digits")
      .regex(/^[0-9]+$/, "Phone number must contain only digits"),
    customerName: z.string().optional(),
    customerEmail: z.email("Invalid email").optional().or(z.literal("")),
    secondaryPhone: z.string().optional(),
    specialInstructions: z.string().optional(),
    deliveryAddress: z
      .string()
      .min(10, "Delivery address must be at least 10 characters")
      .max(220, "Delivery address must be at most 220 characters")
      .optional(),
    recipientCityId: z.number().int().positive().optional(),
    recipientZoneId: z.number().int().positive().optional(),
    recipientAreaId: z.number().int().positive().optional(),
    deliveryLocation: z.enum(DeliveryLocation, {
      error: "Delivery location is required"
    }),
    storeId: z.string({
      error: "Store ID is required"
    }),
    paymentMethod: z.enum(PaymentMethod).optional(),
    items: z
      .array(
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
            .min(1, "Quantity must be at least 1")
        })
      )
      .min(1, "At least one item is required")
  })
});

const updateOrderZodSchema = z.object({
  body: z.object({
    // Customer Info
    customerPhone: z
      .string()
      .length(11, "Phone number must be exactly 11 digits")
      .regex(/^[0-9]+$/, "Phone number must contain only digits")
      .optional(),
    customerName: z.string().optional(),
    customerEmail: z.email("Invalid email").optional().or(z.literal("")),
    secondaryPhone: z.string().optional(),
    specialInstructions: z.string().optional(),

    // Delivery Info
    recipientCityId: z.number().int().positive().optional(),
    recipientZoneId: z.number().int().positive().optional(),
    recipientAreaId: z.number().int().positive().optional(),
    deliveryAddress: z
      .string()
      .min(10, "Delivery address must be at least 10 characters")
      .max(220, "Delivery address must be at most 220 characters")
      .optional(),
    deliveryLocation: z.enum(DeliveryLocation).optional(),

    // Items (optional - if provided, will replace all items)
    items: z
      .array(
        z.object({
          id: z.string().optional(), // Existing item ID (if editing)
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
          priceOverride: z.number().positive().optional() // Vendor can override price
        })
      )
      .optional(),

    // Override delivery charge
    deliveryChargeOverride: z.number().nonnegative().optional(),

    // Edit notes
    editNotes: z.string().optional()
  })
});

const updateOrderStatusZodSchema = z.object({
  body: z.object({
    status: z.enum(OrderStatus, {
      error: "Status is required"
    }),
    editNotes: z.string().optional()
  })
});

const assignBranchToItemZodSchema = z.object({
  body: z.object({
    branchId: z.string({
      error: "Branch ID is required"
    })
  })
});

const createManualOrderZodSchema = z.object({
  body: z.object({
    storeId: z.string({
      error: "Store ID is required"
    }),
    customerName: z.string({
      error: "Customer name is required"
    }),
    customerPhone: z
      .string({ error: "Customer phone is required" })
      .length(11, "Phone number must be exactly 11 digits")
      .regex(/^[0-9]+$/, "Phone number must contain only digits"),
    customerEmail: z.email("Invalid email").optional().or(z.literal("")),
    secondaryPhone: z.string().optional(),
    specialInstructions: z.string().optional(),
    deliveryLocation: z.enum(DeliveryLocation, {
      error: "Delivery location is required"
    }),
    deliveryAddress: z
      .string()
      .min(10, "Delivery address must be at least 10 characters")
      .max(220, "Delivery address must be at most 220 characters")
      .optional(),
    recipientCityId: z.number().int().positive().optional(),
    recipientZoneId: z.number().int().positive().optional(),
    recipientAreaId: z.number().int().positive().optional(),
    items: z
      .array(
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
          unitPrice: z
            .number({
              error: "Unit price is required"
            })
            .positive("Unit price must be positive")
        })
      )
      .min(1, "At least one item is required"),
    paymentMethod: z.enum(PaymentMethod, {
      error: "Payment method is required"
    }),
    deliveryCharge: z.number().nonnegative().optional().default(0),
    totalDiscount: z.number().nonnegative().optional().default(0),
    notes: z.string().optional()
  })
});

const cancelOrderZodSchema = z.object({
  body: z.object({
    reason: z.string().optional()
  })
});

export const OrderValidation = {
  createOrderZodSchema,
  updateOrderZodSchema,
  updateOrderStatusZodSchema,
  assignBranchToItemZodSchema,
  createManualOrderZodSchema,
  cancelOrderZodSchema
};
