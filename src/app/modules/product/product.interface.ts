export interface IProductFilterRequest {
  searchTerm?: string;
  categoryId?: string;
  brandId?: string;
  storeId?: string;
  isActive?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface ICreateProductRequest {
  name: string;
  description?: string;
  basePrice: number;
  comparePrice?: number;
  categoryId: string;
  brandId: string;
  storeId: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  freeShipping?: boolean;
  attributeIds?: string[]; // Attributes this product will use
}

export interface IUpdateProductRequest {
  name?: string;
  description?: string;
  basePrice?: number;
  comparePrice?: number;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  freeShipping?: boolean;
}
