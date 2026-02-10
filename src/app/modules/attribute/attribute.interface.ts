export interface IAttributeFilterRequest {
  searchTerm?: string;
  isActive?: boolean;
  type?: string;
}

export interface ICreateAttributeRequest {
  name: string;
  displayName?: string;
  type?: string;
}

export interface IUpdateAttributeRequest {
  name?: string;
  displayName?: string;
  type?: string;
  isActive?: boolean;
}

export interface ICreateAttributeValueRequest {
  attributeId: string;
  value: string;
  colorCode?: string;
  imageUrl?: string;
}

export interface IUpdateAttributeValueRequest {
  value?: string;
  colorCode?: string;
  imageUrl?: string;
}
