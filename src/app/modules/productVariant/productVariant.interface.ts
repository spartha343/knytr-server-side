export interface IProductVariantFilterRequest {
  productId?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface ICreateProductVariantRequest {
  productId: string;
  sku: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  attributeValueIds: string[]; // Array of attribute value IDs
}

export interface IUpdateProductVariantRequest {
  sku?: string;
  price?: number;
  comparePrice?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface IBulkCreateVariantsRequest {
  productId: string;
  variants: {
    sku: string;
    price: number;
    comparePrice?: number;
    imageUrl?: string;
    attributeValueIds: string[];
  }[];
}
