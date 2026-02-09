import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import { storeSearchableFields } from "./store.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateStoreRequest,
  IStoreFilterRequest,
  IUpdateStoreRequest
} from "./store.interface";
import type { Prisma, Store } from "../../../generated/prisma/client";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import type { IGenericResponse } from "../../../interfaces/common";

// Helper: Generate unique slug
const generateSlug = async (name: string): Promise<string> => {
  let slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Check if slug exists
  const existingStore = await prisma.store.findUnique({
    where: { slug, isDeleted: false }
  });

  if (existingStore) {
    // Add random suffix
    slug = `${slug}-${Date.now()}`;
  }

  return slug;
};

const createStore = async (
  vendorId: string,
  payload: ICreateStoreRequest
): Promise<Store> => {
  // Check if vendor already has 3 stores
  const storeCount = await prisma.store.count({
    where: {
      vendorId,
      isDeleted: false
    }
  });

  if (storeCount >= 3) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You can only create up to 3 stores"
    );
  }

  // Generate unique slug
  const slug = await generateSlug(payload.name);

  const result = await prisma.store.create({
    data: {
      ...payload,
      slug,
      vendorId
    },
    include: {
      vendor: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  return result;
};

const getAllStores = async (
  filters: IStoreFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Store[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Always exclude soft-deleted stores
  andConditions.push({ isDeleted: false });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: storeSearchableFields.map((field) => ({
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
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          equals: (filterData as any)[key]
        }
      }))
    });
  }

  const whereConditions: Prisma.StoreWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.store.findMany({
    include: {
      vendor: {
        select: {
          id: true,
          email: true
        }
      }
    },
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.store.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getMyStores = async (
  vendorId: string,
  options: IPaginationOptions
): Promise<IGenericResponse<Store[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);

  const result = await prisma.store.findMany({
    where: {
      vendorId,
      isDeleted: false
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.store.count({
    where: {
      vendorId,
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

const getStoreById = async (id: string): Promise<Store | null> => {
  const result = await prisma.store.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      vendor: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  return result;
};

const updateStore = async (
  id: string,
  vendorId: string,
  payload: IUpdateStoreRequest
): Promise<Store> => {
  // Check if store exists and belongs to vendor
  const existingStore = await prisma.store.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingStore) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  if (existingStore.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this store"
    );
  }

  // Build update data - only include fields that are in the payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
    // If name is being updated, regenerate slug
    if (payload.name !== existingStore.name) {
      updateData.slug = await generateSlug(payload.name);
    }
  }

  if (payload.description !== undefined) {
    updateData.description = payload.description;
  }

  if (payload.logo !== undefined) {
    updateData.logo = payload.logo;
  }

  if (payload.banner !== undefined) {
    updateData.banner = payload.banner;
  }

  if (payload.isActive !== undefined) {
    updateData.isActive = payload.isActive;
  }

  if (payload.seoTitle !== undefined) {
    updateData.seoTitle = payload.seoTitle;
  }

  if (payload.seoDescription !== undefined) {
    updateData.seoDescription = payload.seoDescription;
  }

  if (payload.seoKeywords !== undefined) {
    updateData.seoKeywords = payload.seoKeywords;
  }

  const result = await prisma.store.update({
    where: { id },
    data: updateData,
    include: {
      vendor: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  return result;
};

const deleteStore = async (id: string, vendorId: string): Promise<Store> => {
  // Check if store exists and belongs to vendor
  const existingStore = await prisma.store.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingStore) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  if (existingStore.vendorId !== vendorId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this store"
    );
  }

  // Soft delete
  const result = await prisma.store.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });

  return result;
};

export const StoreService = {
  createStore,
  getAllStores,
  getMyStores,
  getStoreById,
  updateStore,
  deleteStore
};
