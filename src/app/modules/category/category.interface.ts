export interface ICategoryFilterRequest {
  searchTerm?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface ICreateCategoryRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface IUpdateCategoryRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
