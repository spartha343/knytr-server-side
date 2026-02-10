import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import { categorySearchableFields } from "./category.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateCategoryRequest,
  ICategoryFilterRequest,
  IUpdateCategoryRequest
} from "./category.interface";
import type { Prisma, Category } from "../../../generated/prisma/client";
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
  const existingCategory = await prisma.category.findUnique({
    where: { slug, isDeleted: false }
  });

  if (existingCategory) {
    // Add random suffix
    slug = `${slug}-${Date.now()}`;
  }

  return slug;
};

// Helper: Check for circular reference in parent-child relationship
const checkCircularReference = async (
  categoryId: string,
  parentId: string
): Promise<void> => {
  let currentParentId: string | null = parentId;

  while (currentParentId) {
    if (currentParentId === categoryId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Circular reference detected. A category cannot be its own ancestor."
      );
    }

    const parent: { parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: currentParentId },
        select: { parentId: true }
      });

    currentParentId = parent?.parentId || null;
  }
};

const createCategory = async (
  payload: ICreateCategoryRequest
): Promise<Category> => {
  // Check for duplicate name (case-insensitive)
  const existingCategory = await prisma.category.findFirst({
    where: {
      name: {
        equals: payload.name,
        mode: "insensitive"
      },
      isDeleted: false
    }
  });

  if (existingCategory) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Category with this name already exists"
    );
  }

  // If parentId is provided, verify parent exists and is active
  if (payload.parentId) {
    const parentCategory = await prisma.category.findUnique({
      where: { id: payload.parentId, isDeleted: false }
    });

    if (!parentCategory) {
      throw new ApiError(httpStatus.NOT_FOUND, "Parent category not found");
    }

    if (!parentCategory.isActive) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Parent category is not active"
      );
    }
  }

  // Generate unique slug
  const slug = await generateSlug(payload.name);

  const result = await prisma.category.create({
    data: {
      ...payload,
      slug
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  return result;
};

const getAllCategories = async (
  filters: ICategoryFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Category[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Always exclude soft-deleted categories
  andConditions.push({ isDeleted: false });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: categorySearchableFields.map((field) => ({
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

  const whereConditions: Prisma.CategoryWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.category.findMany({
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      children: {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true
        }
      }
    },
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.category.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getCategoryById = async (id: string): Promise<Category | null> => {
  const result = await prisma.category.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      children: {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          isActive: true
        }
      }
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  return result;
};

const getCategoryChildren = async (id: string): Promise<Category[]> => {
  // Verify parent category exists
  const parentCategory = await prisma.category.findUnique({
    where: { id, isDeleted: false }
  });

  if (!parentCategory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  const children = await prisma.category.findMany({
    where: {
      parentId: id,
      isDeleted: false
    },
    include: {
      children: {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  return children;
};

const updateCategory = async (
  id: string,
  payload: IUpdateCategoryRequest
): Promise<Category> => {
  // Check if category exists
  const existingCategory = await prisma.category.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingCategory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  // Check for duplicate name (if name is being updated)
  if (payload.name && payload.name !== existingCategory.name) {
    const duplicateCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: "insensitive"
        },
        isDeleted: false,
        NOT: { id }
      }
    });

    if (duplicateCategory) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category with this name already exists"
      );
    }
  }

  // If parentId is being updated, validate
  if (payload.parentId !== undefined) {
    if (payload.parentId) {
      // Check parent exists and is active
      const parentCategory = await prisma.category.findUnique({
        where: { id: payload.parentId, isDeleted: false }
      });

      if (!parentCategory) {
        throw new ApiError(httpStatus.NOT_FOUND, "Parent category not found");
      }

      if (!parentCategory.isActive) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Parent category is not active"
        );
      }

      // Check for circular reference
      await checkCircularReference(id, payload.parentId);
    }
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
    // If name is being updated, regenerate slug
    if (payload.name !== existingCategory.name) {
      updateData.slug = await generateSlug(payload.name);
    }
  }

  if (payload.description !== undefined) {
    updateData.description = payload.description;
  }

  if (payload.imageUrl !== undefined) {
    updateData.imageUrl = payload.imageUrl;
  }

  if (payload.parentId !== undefined) {
    updateData.parentId = payload.parentId;
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

  const result = await prisma.category.update({
    where: { id },
    data: updateData,
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      children: {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  return result;
};

const deleteCategory = async (id: string): Promise<Category> => {
  // Check if category exists
  const existingCategory = await prisma.category.findUnique({
    where: { id, isDeleted: false }
  });

  if (!existingCategory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  // Check if category has children
  const childrenCount = await prisma.category.count({
    where: {
      parentId: id,
      isDeleted: false
    }
  });

  if (childrenCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot delete category with child categories. Delete or reassign child categories first."
    );
  }

  // TODO: Check if category has products (when Product model is implemented)
  // const productCount = await prisma.product.count({
  //   where: { categoryId: id }
  // });
  // if (productCount > 0) {
  //   throw new ApiError(
  //     httpStatus.BAD_REQUEST,
  //     "Cannot delete category with products. Reassign products first."
  //   );
  // }

  // Soft delete
  const result = await prisma.category.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });

  return result;
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryChildren,
  updateCategory,
  deleteCategory
};
