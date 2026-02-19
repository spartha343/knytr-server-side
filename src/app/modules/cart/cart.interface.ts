import type { Prisma } from "../../../generated/prisma/client";

export interface IAddToCartPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface IUpdateCartItemPayload {
  quantity: number;
}

export interface ISyncCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  priceSnapshot: number;
}

export interface ISyncCartPayload {
  items: ISyncCartItem[];
}

export interface ISyncCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  priceSnapshot: number;
}

export interface ISyncCartPayload {
  items: ISyncCartItem[];
}

export interface ISyncCartAdjustment {
  productName: string;
  requestedQty: number;
  adjustedQty: number;
}

export interface ISyncCartSkipped {
  productName: string;
  reason: string;
}

export interface ISyncCartResponse {
  cart: Prisma.CartGetPayload<{
    include: {
      items: {
        include: {
          product: true;
          variant: true;
        };
      };
    };
  }> | null;
  adjustments: ISyncCartAdjustment[];
  skipped: ISyncCartSkipped[];
}
