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
