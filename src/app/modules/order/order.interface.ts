import type {
  DeliveryLocation,
  OrderStatus,
  PaymentMethod
} from "../../../generated/prisma/client";

export interface ICreateOrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ICreateOrderRequest {
  // Customer Info (Phone is REQUIRED)
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;

  // Delivery Info
  deliveryAddress?: string;
  deliveryLocation: DeliveryLocation;
  recipientCityId?: number;
  recipientZoneId?: number;
  recipientAreaId?: number;

  // Order Details
  storeId: string;
  paymentMethod?: PaymentMethod;

  // Items
  items: ICreateOrderItem[];
}

export interface IUpdateOrderItem {
  id?: string; // If editing existing item
  productId: string;
  variantId?: string;
  quantity: number;
  priceOverride?: number; // Vendor can override price for this order
}

export interface IUpdateOrderRequest {
  // Customer Info
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  secondaryPhone?: string;
  specialInstructions?: string;

  // Delivery Info
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  recipientCityId?: number;
  recipientZoneId?: number;
  recipientAreaId?: number;

  // Items (if provided, will replace all items)
  items?: IUpdateOrderItem[];

  // Override delivery charge
  deliveryChargeOverride?: number;

  // Notes about edits
  editNotes?: string;
}

export interface IUpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface IAssignBranchToItemRequest {
  branchId: string;
}

export interface IOrderFilterRequest {
  searchTerm?: string;
  status?: OrderStatus;
  storeId?: string;
  userId?: string;
  paymentMethod?: PaymentMethod;
  deliveryLocation?: DeliveryLocation;
}

export interface ICancelOrderRequest {
  reason?: string;
}

export interface IOrderActivity {
  id: string;
  orderId: string;
  userId?: string;
  action: string;
  description?: string;
  createdAt: Date;
}
