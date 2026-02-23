import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import { brandSearchableFields } from "./brand.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateBrandRequest,
  IBrandFilterRequest,
  IUpdateBrandRequest
} from "./brand.interface";
import type { Prisma, Brand } from "../../../generated/prisma/client";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import type { IGenericResponse } from "../../../interfaces/common";
import { imageHelper } from "../../../helpers/imageHelper";

// Helper: Generate unique slug
const generateSlug = async (name: string): Promise<string> => {
  let slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Check if slug exists
  const existingBrand = await prisma.brand.findUnique({
    where: { slug, isDeleted: false }
  });

  if (existingBrand) {
    // Add random suffix
    slug = `${slug}-${Date.now()}`;
  }

  return slug;
};

const createBrand = async (payload: ICreateBrandRequest): Promise<Brand> => {
  // Check for duplicate name (case-insensitive)
  const existingBrand = await prisma.brand.findFirst({
    where: {
      name: {
        equals: payload.name,
        mode: "insensitive"
      },
      isDeleted: false
    }
  });

  if (existingBrand) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Brand with this name already exists"
    );
  }

  // Generate unique slug
  const slug = await generateSlug(payload.name);

  const result = await prisma.brand.create({
    data: {
      ...payload,
      slug
    }
  });

  return result;
};

const getAllBrands = async (
  filters: IBrandFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Brand[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Always exclude soft-deleted brands
  andConditions.push({ isDeleted: false });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: brandSearchableFields.map((field) => ({
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

  const whereConditions: Prisma.BrandWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.brand.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.brand.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getBrandById = async (id: string): Promise<Brand | null> => {
  const result = await prisma.brand.findUnique({
    where: {
      id,
      isDeleted: false
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
  }

  return result;
};

const updateBrand = async (
  id: string,
  payload: IUpdateBrandRequest
): Promise<Brand> => {
  // Check if brand exists
  const existingBrand = await prisma.brand.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingBrand) {
    throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
  }

  // Check for duplicate name (if name is being updated)
  if (payload.name && payload.name !== existingBrand.name) {
    const duplicateBrand = await prisma.brand.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: "insensitive"
        },
        isDeleted: false,
        NOT: { id }
      }
    });

    if (duplicateBrand) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Brand with this name already exists"
      );
    }
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
    // If name is being updated, regenerate slug
    if (payload.name !== existingBrand.name) {
      updateData.slug = await generateSlug(payload.name);
    }
  }

  if (payload.description !== undefined) {
    updateData.description = payload.description;
  }

  if (payload.logoUrl !== undefined) {
    // Delete old logo from Cloudinary if it exists and is being replaced
    if (existingBrand.logoUrl && payload.logoUrl !== existingBrand.logoUrl) {
      try {
        const publicId = imageHelper.extractPublicId(existingBrand.logoUrl);
        await imageHelper.deleteFromCloudinary(publicId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          "Failed to delete old brand logo from Cloudinary:",
          error
        );
      }
    }
    updateData.logoUrl = payload.logoUrl;
  }

  if (payload.websiteUrl !== undefined) {
    updateData.websiteUrl = payload.websiteUrl;
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

  const result = await prisma.brand.update({
    where: { id },
    data: updateData
  });

  return result;
};

const deleteBrand = async (id: string): Promise<Brand> => {
  // Check if brand exists
  const existingBrand = await prisma.brand.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingBrand) {
    throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
  }

  // TODO: Check if brand has products (when Product model is implemented)
  // const productCount = await prisma.product.count({
  //   where: { brandId: id }
  // });
  // if (productCount > 0) {
  //   throw new ApiError(
  //     httpStatus.BAD_REQUEST,
  //     "Cannot delete brand with products. Reassign products first."
  //   );
  // }

  // Soft delete
  const result = await prisma.brand.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });

  return result;
};

export const BrandService = {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand
};
