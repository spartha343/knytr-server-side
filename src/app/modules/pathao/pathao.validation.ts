import { z } from "zod";

const saveCredentials = z.object({
  body: z.object({
    branchId: z.string({
      error: "Branch ID is required"
    }),
    clientId: z.string({
      error: "Client ID is required"
    }),
    clientSecret: z.string({
      error: "Client Secret is required"
    }),
    username: z
      .string({
        error: "Username is required"
      })
      .email("Username must be a valid email"),
    password: z.string({
      error: "Password is required"
    }),
    environment: z.enum(["sandbox", "production"], {
      message: "Environment must be either 'sandbox' or 'production'"
    }),
    webhookSecret: z.string().optional()
  })
});

const registerStore = z.object({
  body: z.object({
    branchId: z.string({
      error: "Branch ID is required"
    }),
    name: z
      .string({
        error: "Store name is required"
      })
      .min(3, "Store name must be at least 3 characters")
      .max(50, "Store name must not exceed 50 characters"),
    contactName: z
      .string({
        error: "Contact name is required"
      })
      .min(3, "Contact name must be at least 3 characters")
      .max(50, "Contact name must not exceed 50 characters"),
    contactNumber: z
      .string({
        error: "Contact number is required"
      })
      .length(11, "Contact number must be exactly 11 digits"),
    secondaryContact: z
      .string()
      .length(11, "Secondary contact must be exactly 11 digits")
      .optional(),
    otpNumber: z
      .string()
      .length(11, "OTP number must be exactly 11 digits")
      .optional(),
    cityId: z.number({
      error: "City ID is required"
    }),
    zoneId: z.number({
      error: "Zone ID is required"
    }),
    areaId: z.number({
      error: "Area ID is required"
    })
  })
});

const createDeliveryWithLocation = z.object({
  body: z.object({
    recipientCityId: z
      .number({
        error: "Recipient city ID is required"
      })
      .int()
      .positive(),
    recipientZoneId: z
      .number({
        error: "Recipient zone ID is required"
      })
      .int()
      .positive(),
    recipientAreaId: z
      .number({
        error: "Recipient area ID is required"
      })
      .int()
      .positive()
  })
});

export const PathaoValidation = {
  saveCredentials,
  registerStore,
  createDeliveryWithLocation
};
