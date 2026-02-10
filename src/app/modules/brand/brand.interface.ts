export interface IBrandFilterRequest {
  searchTerm?: string;
  isActive?: boolean;
}

export interface ICreateBrandRequest {
  name: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface IUpdateBrandRequest {
  name?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
