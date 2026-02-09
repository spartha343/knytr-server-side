import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import { branchSearchableFields } from "./branch.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  IBranchFilterRequest,
  ICreateBranchRequest,
  IUpdateBranchRequest
} from "./branch.interface";
import type { Branch, Prisma } from "../../../generated/prisma/client";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import type { IGenericResponse } from "../../../interfaces/common";

const createBranch = async (
  vendorId: string,
  payload: ICreateBranchRequest
): Promise<Branch> => {
  // Verify store exists and belongs to vendor
  const store = await prisma.store.findUnique({
    where: {
      id: payload.storeId,
      isDeleted: false
    }
  });

  if (!store) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  if (store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to add branches to this store"
    );
  }

  // Create branch with address in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Build branch data with proper null handling
    const branchData: Prisma.BranchCreateInput = {
      name: payload.name,
      store: {
        connect: { id: payload.storeId }
      },
      ...(payload.contactPhone && { contactPhone: payload.contactPhone }),
      ...(payload.contactEmail && { contactEmail: payload.contactEmail })
    };

    // Create branch
    const branch = await tx.branch.create({
      data: branchData,
      include: {
        store: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Build address data with proper null handling
    const addressData: Prisma.AddressCreateInput = {
      branch: {
        connect: { id: branch.id }
      },
      addressLine1: payload.address.addressLine1,
      city: payload.address.city,
      postalCode: payload.address.postalCode,
      country: payload.address.country || "Bangladesh",
      ...(payload.address.addressLine2 && {
        addressLine2: payload.address.addressLine2
      }),
      ...(payload.address.state && { state: payload.address.state }),
      ...(payload.address.latitude !== undefined && {
        latitude: payload.address.latitude
      }),
      ...(payload.address.longitude !== undefined && {
        longitude: payload.address.longitude
      })
    };

    // Create address
    await tx.address.create({
      data: addressData
    });

    // Fetch branch with address
    const branchWithAddress = await tx.branch.findUnique({
      where: { id: branch.id },
      include: {
        store: {
          select: {
            id: true,
            name: true
          }
        },
        address: true
      }
    });

    return branchWithAddress!;
  });

  return result;
};

const getAllBranches = async (
  filters: IBranchFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Branch[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.BranchWhereInput[] = [];

  // Always exclude soft-deleted branches
  andConditions.push({ isDeleted: false });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: branchSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode
        }
      }))
    });
  }

  // Filter functionality
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => {
        if (key === "storeId") {
          return {
            storeId: {
              equals: filterData[key as keyof typeof filterData] as string
            }
          };
        }
        if (key === "isActive") {
          return {
            isActive: {
              equals: filterData[key as keyof typeof filterData] as boolean
            }
          };
        }
        return {};
      })
    });
  }

  const whereConditions: Prisma.BranchWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.branch.findMany({
    include: {
      store: {
        select: {
          id: true,
          name: true,
          vendor: {
            select: {
              id: true,
              email: true
            }
          }
        }
      },
      address: true
    },
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.branch.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getBranchesByStore = async (
  storeId: string,
  options: IPaginationOptions
): Promise<IGenericResponse<Branch[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);

  const result = await prisma.branch.findMany({
    where: {
      storeId,
      isDeleted: false
    },
    include: {
      address: true
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.branch.count({
    where: {
      storeId,
      isDeleted: false
    }
  });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getBranchById = async (id: string): Promise<Branch | null> => {
  const result = await prisma.branch.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          vendor: {
            select: {
              id: true,
              email: true
            }
          }
        }
      },
      address: true
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Branch not found");
  }

  return result;
};

const updateBranch = async (
  id: string,
  vendorId: string,
  payload: IUpdateBranchRequest
): Promise<Branch> => {
  // Check if branch exists and belongs to vendor's store
  const existingBranch = await prisma.branch.findUnique({
    where: { id, isDeleted: false },
    include: {
      store: true
    }
  });

  if (!existingBranch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Branch not found");
  }

  if (existingBranch.store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this branch"
    );
  }

  // Update branch and address in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Build branch update data
    const branchUpdateData: Prisma.BranchUpdateInput = {};
    if (payload.name !== undefined) branchUpdateData.name = payload.name;
    if (payload.contactPhone !== undefined)
      branchUpdateData.contactPhone = payload.contactPhone;
    if (payload.contactEmail !== undefined)
      branchUpdateData.contactEmail = payload.contactEmail;
    if (payload.isActive !== undefined)
      branchUpdateData.isActive = payload.isActive;

    // Update branch if there's data
    if (Object.keys(branchUpdateData).length > 0) {
      await tx.branch.update({
        where: { id },
        data: branchUpdateData
      });
    }

    // Update address if provided
    if (payload.address && Object.keys(payload.address).length > 0) {
      const addressUpdateData: Prisma.AddressUpdateInput = {};
      if (payload.address.addressLine1 !== undefined)
        addressUpdateData.addressLine1 = payload.address.addressLine1;
      if (payload.address.addressLine2 !== undefined)
        addressUpdateData.addressLine2 = payload.address.addressLine2;
      if (payload.address.city !== undefined)
        addressUpdateData.city = payload.address.city;
      if (payload.address.state !== undefined)
        addressUpdateData.state = payload.address.state;
      if (payload.address.postalCode !== undefined)
        addressUpdateData.postalCode = payload.address.postalCode;
      if (payload.address.country !== undefined)
        addressUpdateData.country = payload.address.country;
      if (payload.address.latitude !== undefined)
        addressUpdateData.latitude = payload.address.latitude;
      if (payload.address.longitude !== undefined)
        addressUpdateData.longitude = payload.address.longitude;

      await tx.address.update({
        where: { branchId: id },
        data: addressUpdateData
      });
    }

    // Fetch updated branch with relations
    const updatedBranch = await tx.branch.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true
          }
        },
        address: true
      }
    });

    return updatedBranch!;
  });

  return result;
};

const deleteBranch = async (id: string, vendorId: string): Promise<Branch> => {
  // Check if branch exists and belongs to vendor's store
  const existingBranch = await prisma.branch.findUnique({
    where: { id, isDeleted: false },
    include: {
      store: true
    }
  });

  if (!existingBranch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Branch not found");
  }

  if (existingBranch.store.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this branch"
    );
  }

  // Soft delete
  const result = await prisma.branch.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });

  return result;
};

export const BranchService = {
  createBranch,
  getAllBranches,
  getBranchesByStore,
  getBranchById,
  updateBranch,
  deleteBranch
};
