import { z } from "zod";
import {
  DeliveryLocation,
  OrderStatus,
  PaymentMethod
} from "../../../generated/prisma/client";

const createOrderZodSchema = z.object({
  body: z.object({
    customerPhone: z
      .string({
        error: "Customer phone is required"
      })
      .min(11, "Phone number must be at least 11 digits"),
    customerName: z.string().optional(),
    customerEmail: z.email("Invalid email").optional().or(z.literal("")),
    policeStation: z.string().optional(),
    deliveryDistrict: z.string().optional(),
    deliveryArea: z.string().optional(),
    deliveryAddress: z.string().optional(),
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
    customerPhone: z
      .string()
      .min(11, "Phone number must be at least 11 digits")
      .optional(),
    customerName: z.string().optional(),
    customerEmail: z.email("Invalid email").optional().or(z.literal("")),
    policeStation: z.string().optional(),
    deliveryDistrict: z.string().optional(),
    deliveryArea: z.string().optional(),
    deliveryAddress: z.string().optional(),
    deliveryLocation: z.enum(DeliveryLocation).optional(),
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

export const OrderValidation = {
  createOrderZodSchema,
  updateOrderZodSchema,
  updateOrderStatusZodSchema,
  assignBranchToItemZodSchema
};
