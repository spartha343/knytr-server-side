export interface IStoreFilterRequest {
  searchTerm?: string;
  vendorId?: string;
  isActive?: boolean;
}

export interface ICreateStoreRequest {
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface IUpdateStoreRequest {
  name?: string;
  description?: string;
  logo?: string;
  banner?: string;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
