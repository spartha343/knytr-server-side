/* eslint-disable no-unused-vars */
// ============================================
// PATHAO API REQUEST/RESPONSE INTERFACES
// ============================================

// Authentication
export interface IPathaoAuthRequest {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  grant_type: "password";
}

export interface IPathaoAuthResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

// City, Zone, Area
export interface IPathaoCityResponse {
  data: {
    data: {
      city_id: number;
      city_name: string;
    }[];
  };
}

export interface IPathaoZoneResponse {
  data: {
    data: {
      zone_id: number;
      zone_name: string;
    }[];
  };
}

export interface IPathaoAreaResponse {
  data: {
    data: {
      area_id: number;
      area_name: string;
      home_delivery_available: boolean;
      pickup_available: boolean;
    }[];
  };
}

// Store Management
export interface IPathaoStoreCreateRequest {
  name: string;
  contact_name: string;
  contact_number: string;
  address: string;
  city_id: number;
  zone_id: number;
  area_id: number;
  [key: string]: string | number | boolean | undefined;
}

export interface IPathaoStoreResponse {
  type: string;
  code: number;
  message: string;
  data: {
    store_name: string;
  };
}

export interface IPathaoStoresListResponse {
  message: string;
  type: string;
  code: number;
  data: {
    data: {
      store_id: number;
      store_name: string;
      store_address: string;
      is_active: number;
      city_id: number;
      zone_id: number;
      hub_id: number;
      is_default_store: boolean;
      is_default_return_store: boolean;
    }[];
    total: number;
    current_page: number;
    per_page: number;
  };
}

// Price Calculation
export interface IPathaoPriceCalculationRequest {
  delivery_type: number;
  item_type: number;
  item_weight: number;
  recipient_city: number;
  recipient_zone: number;
  store_id: number;
}

export interface IPathaoPriceCalculationResponse {
  type: string;
  code: number;
  message: string;
  data: {
    price: number;
    original_price: number;
    discount: number;
    additional_charge: number;
    promo_discount: number;
  };
}

// Order Creation
export interface IPathaoOrderCreateRequest {
  store_id: number;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_secondary_phone?: string;
  recipient_address: string;
  recipient_city: number;
  recipient_zone: number;
  recipient_area: number;
  delivery_type: number;
  item_type: number;
  item_quantity: number;
  item_weight: number;
  item_description: string;
  amount_to_collect: number;
  special_instruction?: string;
  delivery?: {
    picked_up_at?: string;
    delivered_at?: string;
  };
}

export interface IPathaoOrderCreateResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    merchant_order_id: string;
    order_status: string;
    invoice_id: string;
  };
}

// Order Status
export interface IPathaoOrderStatusResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    merchant_order_id: string;
    order_status: string;
    order_type: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    recipient_city: string;
    recipient_zone: string;
    recipient_area: string;
    delivery_fee: number;
    item_description: string;
    amount_to_collect: number;
    created_at: string;
    updated_at: string;
  };
}

// Webhook Payload
export interface IPathaoWebhookPayload {
  event_type: string;
  consignment_id: string;
  merchant_order_id: string;
  order_status: string;
  updated_at: string;
  action_time?: string;
  rider_name?: string;
  rider_phone?: string;
  delivery_fee?: number;
}

// ============================================
// INTERNAL APPLICATION INTERFACES
// ============================================

export interface ICreatePathaoDeliveryRequest {
  orderId: string;
  storeId?: number; // Optional, will auto-detect from order
}

export interface IRetryPathaoDeliveryRequest {
  deliveryId: string;
}

export interface ICalculateDeliveryChargeRequest {
  orderId: string;
}

export interface IRegisterStoreRequest {
  branchId: string;
  name: string;
  contactName: string;
  contactNumber: string;
}

export interface IPathaoCredentialsInput {
  branchId: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  environment: "sandbox" | "production";
  webhookSecret?: string;
}

// ============================================
// ENUMS
// ============================================

export enum PathaoEnvironment {
  SANDBOX = "sandbox",
  PRODUCTION = "production"
}

export enum PathaoDeliveryStatus {
  // Initial states
  PENDING = "PENDING",
  CREATING = "CREATING",
  CREATED = "CREATED",

  // Pickup flow
  PICKUP_REQUESTED = "PICKUP_REQUESTED",
  ASSIGNED_FOR_PICKUP = "ASSIGNED_FOR_PICKUP",
  PICKED_UP = "PICKED_UP",
  PICKUP_FAILED = "PICKUP_FAILED",
  PICKUP_CANCELLED = "PICKUP_CANCELLED",

  // Transit flow
  AT_SORTING_HUB = "AT_SORTING_HUB",
  IN_TRANSIT = "IN_TRANSIT",
  RECEIVED_AT_LAST_MILE = "RECEIVED_AT_LAST_MILE",

  // Delivery flow
  ASSIGNED_FOR_DELIVERY = "ASSIGNED_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  PARTIAL_DELIVERY = "PARTIAL_DELIVERY",
  DELIVERY_FAILED = "DELIVERY_FAILED",

  // Return/hold/cancel flow
  RETURNED = "RETURNED",
  ON_HOLD = "ON_HOLD",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED"
}

export enum PathaoItemType {
  DOCUMENT = 1,
  PARCEL = 2
}

export enum PathaoDeliveryType {
  EXPRESS = 12,
  NORMAL = 48
}

// ============================================
// ERROR HANDLING
// ============================================

export interface IPathaoError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  canRetry: boolean;
}

export class PathaoApiError extends Error {
  public code: string;
  public details: Record<string, unknown> | undefined;
  public canRetry: boolean;

  constructor(
    message: string,
    code = "PATHAO_API_ERROR",
    details?: Record<string, unknown>,
    canRetry = true
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.canRetry = canRetry;
    this.name = "PathaoApiError";
  }
}

// ============================================
// SERVICE RESPONSE TYPES
// ============================================

export interface IPathaoServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: IPathaoError;
}
