export const orderSearchableFields = [
  "orderNumber",
  "customerName",
  "customerPhone",
  "customerEmail"
];

export const orderFilterableFields = [
  "searchTerm",
  "status",
  "storeId",
  "userId",
  "paymentMethod",
  "deliveryLocation",
  "isVoiceConfirmed"
];

export const orderRelations = {
  include: {
    user: {
      select: {
        id: true,
        email: true,
        firebaseUid: true
      }
    },
    store: {
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        contactPhone: true,
        whatsappNumber: true
      }
    },
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        variant: {
          select: {
            id: true,
            sku: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            address: {
              select: {
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                postalCode: true
              }
            }
          }
        }
      }
    },
    activities: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firebaseUid: true
          }
        }
      },
      orderBy: {
        createdAt: "desc" as const
      }
    },
    cancelledByUser: {
      select: {
        id: true,
        email: true,
        firebaseUid: true
      }
    },
    pathaoDelivery: {
      include: {
        statusHistory: {
          orderBy: { createdAt: "asc" as const }
        }
      }
    }
  }
};

// Delivery charges (in BDT)
export const DELIVERY_CHARGES: Record<string, number> = {
  INSIDE_DHAKA: 70,
  OUTSIDE_DHAKA: 120
};

// Valid status transitions
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["SHIPPED", "CANCELLED"],
  SHIPPED: [], // Pathao manages from here — no manual transitions
  OUT_FOR_DELIVERY: [], // Pathao managed
  DELIVERED: [], // Terminal
  CANCELLED: [],
  RETURNED: []
};

// Cancellation reasons
export const CANCELLATION_REASONS = [
  "Customer requested cancellation",
  "Out of stock",
  "Customer unreachable",
  "Incorrect order details",
  "Payment issues",
  "Duplicate order",
  "Other"
] as const;
