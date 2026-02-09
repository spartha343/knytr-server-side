export interface IBranchFilterRequest {
  searchTerm?: string;
  storeId?: string;
  isActive?: boolean;
}

export interface ICreateBranchRequest {
  name: string;
  storeId: string;
  contactPhone?: string;
  contactEmail?: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface IUpdateBranchRequest {
  name?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}
