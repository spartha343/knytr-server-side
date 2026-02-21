export const pathaoConstants = {
  // Base URLs
  SANDBOX_BASE_URL: "https://courier-api-sandbox.pathao.com",
  PRODUCTION_BASE_URL: "https://api-hermes.pathao.com",

  // API Endpoints
  ENDPOINTS: {
    AUTH: "/aladdin/api/v1/issue-token",
    CITIES: "/aladdin/api/v1/city-list",
    ZONES: "/aladdin/api/v1/cities/:cityId/zone-list",
    AREAS: "/aladdin/api/v1/zones/:zoneId/area-list",
    STORES: "/aladdin/api/v1/stores",
    PRICE_PLAN: "/aladdin/api/v1/merchant/price-plan",
    CREATE_ORDER: "/aladdin/api/v1/orders",
    TRACK_ORDER: "/aladdin/api/v1/orders/:consignmentId"
  },

  // Default Values
  DEFAULTS: {
    ITEM_TYPE: 2,
    DELIVERY_TYPE: 48,
    DEFAULT_WEIGHT: 0.5,
    TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000
  },

  // Retry Configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 30000,
    BACKOFF_MULTIPLIER: 2
  },

  // Cache TTL
  CACHE: {
    CITIES: 24 * 60 * 60 * 1000,
    ZONES: 24 * 60 * 60 * 1000,
    AREAS: 24 * 60 * 60 * 1000,
    PRICE: 5 * 60 * 1000
  },

  // Bangladesh Cities
  BANGLADESH_CITIES: {
    DHAKA: 1,
    CHATTOGRAM: 2,
    SYLHET: 3,
    RAJSHAHI: 4,
    KHULNA: 5,
    BARISHAL: 6,
    RANGPUR: 7,
    MYMENSINGH: 8
  }
};

export const pathaoErrorMessages = {
  CREDENTIALS_NOT_FOUND:
    "No active Pathao credentials found. Please configure credentials first.",
  NO_CREDENTIALS: "No active Pathao credentials found",
  AUTH_FAILED: "Pathao authentication failed",
  TOKEN_EXPIRED: "Pathao access token expired",
  STORE_NOT_REGISTERED: "Branch not registered with Pathao",
  STORE_REGISTRATION_FAILED: "Failed to register store with Pathao",
  INVALID_ADDRESS: "Invalid delivery address",
  API_ERROR: "Pathao API error",
  NETWORK_ERROR: "Network error while connecting to Pathao",
  ORDER_NOT_FOUND: "Order not found",
  DELIVERY_ALREADY_EXISTS: "Pathao delivery already created for this order",
  PRICE_CALCULATION_FAILED: "Failed to calculate delivery charge",
  ORDER_CREATION_FAILED: "Failed to create Pathao order"
};

export const pathaoSuccessMessages = {
  CREDENTIALS_SAVED: "Pathao credentials saved successfully",
  STORE_REGISTERED: "Store registered with Pathao successfully",
  DELIVERY_CREATED: "Pathao delivery created successfully",
  STATUS_UPDATED: "Delivery status updated successfully",
  RETRY_SUCCESS: "Delivery retry successful"
};
