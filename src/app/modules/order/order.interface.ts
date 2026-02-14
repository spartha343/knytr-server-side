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
  policeStation?: string;
  deliveryDistrict?: string;
  deliveryArea?: string;
  deliveryAddress?: string;
  deliveryLocation: DeliveryLocation;

  // Order Details
  storeId: string;
  paymentMethod?: PaymentMethod;

  // Items
  items: ICreateOrderItem[];
}

export interface IUpdateOrderRequest {
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  policeStation?: string;
  deliveryDistrict?: string;
  deliveryArea?: string;
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  editNotes?: string;
}

export interface IUpdateOrderStatusRequest {
  status: OrderStatus;
  editNotes?: string;
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
  isVoiceConfirmed?: boolean;
}
