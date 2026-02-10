export interface IInventoryFilterRequest {
  variantId?: string;
  branchId?: string;
  productId?: string;
  lowStock?: boolean; // Filter for items below lowStockAlert
}

export interface ICreateInventoryRequest {
  variantId: string;
  branchId: string;
  quantity: number;
  reservedQty?: number;
  lowStockAlert?: number;
}

export interface IUpdateInventoryRequest {
  quantity?: number;
  reservedQty?: number;
  lowStockAlert?: number;
}

export interface IAdjustStockRequest {
  quantity: number; // Positive to add, negative to subtract
  reason?: string;
}

export interface IBulkCreateInventoryRequest {
  variantId: string;
  inventories: {
    branchId: string;
    quantity: number;
    lowStockAlert?: number;
  }[];
}
