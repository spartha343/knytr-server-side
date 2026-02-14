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
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: []
};
