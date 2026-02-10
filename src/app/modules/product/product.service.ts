import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import {
  productSearchableFields,
  productRelationalFields,
  productRelationalFieldsMapper
} from "./product.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateProductRequest,
  IProductFilterRequest,
  IUpdateProductRequest
} from "./product.interface";
import type { Prisma, Product } from "../../../generated/prisma/client";
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
  const existingProduct = await prisma.product.findUnique({
    where: { slug, isDeleted: false }
  });

  if (existingProduct) {
    // Add random suffix
    slug = `${slug}-${Date.now()}`;
  }

  return slug;
};

const createProduct = async (
  userId: string,
  payload: ICreateProductRequest
): Promise<Product> => {
  // Verify user owns the store
  const store = await prisma.store.findUnique({
    where: { id: payload.storeId, isDeleted: false }
  });

  if (!store) {
    throw new ApiError(httpStatus.NOT_FOUND, "Store not found");
  }

  if (store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only create products in your own stores"
    );
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: payload.categoryId, isDeleted: false }
  });

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  // Verify brand exists
  const brand = await prisma.brand.findUnique({
    where: { id: payload.brandId, isDeleted: false }
  });

  if (!brand) {
    throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
  }

  // Generate slug
  const slug = await generateSlug(payload.name);

  // Extract attributeIds from payload
  const { attributeIds, ...productData } = payload;

  // Create product with attributes if provided
  const result = await prisma.product.create({
    data: {
      ...productData,
      slug,
      // Link attributes if provided
      ...(attributeIds &&
        attributeIds.length > 0 && {
          productAttributes: {
            create: attributeIds.map((attributeId) => ({
              attributeId
            }))
          }
        })
    },
    include: {
      category: true,
      brand: true,
      store: true,
      media: true,
      productAttributes: {
        include: {
          attribute: {
            include: {
              values: true
            }
          }
        }
      },
      variants: true
    }
  });

  return result;
};

const getAllProducts = async (
  filters: IProductFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Product[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, ...filterData } = filters;

  const andConditions = [];

  // Always exclude soft-deleted products
  andConditions.push({ isDeleted: false });

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: productSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode
        }
      }))
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: { gte?: number; lte?: number } = {};

    if (minPrice !== undefined) {
      priceFilter.gte = minPrice;
    }

    if (maxPrice !== undefined) {
      priceFilter.lte = maxPrice;
    }

    andConditions.push({
      basePrice: priceFilter
    });
  }

  // Filter functionality
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => {
        const mappedKey = productRelationalFields.includes(key)
          ? productRelationalFieldsMapper[key]
          : key;

        return {
          [mappedKey as string]: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            equals: (filterData as any)[key]
          }
        } as Prisma.ProductWhereInput;
      })
    });
  }

  const whereConditions: Prisma.ProductWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.product.findMany({
    where: whereConditions,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true
        }
      },
      store: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      media: {
        where: { isPrimary: true },
        take: 1
      },
      variants: {
        take: 1,
        orderBy: { price: "asc" }
      }
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.product.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getProductById = async (id: string): Promise<Product | null> => {
  const result = await prisma.product.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      category: true,
      brand: true,
      store: {
        include: {
          branches: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              contactPhone: true
            }
          }
        }
      },
      media: {
        orderBy: {
          order: "asc"
        }
      },
      productAttributes: {
        include: {
          attribute: {
            include: {
              values: true
            }
          }
        }
      },
      variants: {
        where: { isActive: true },
        include: {
          variantAttributes: {
            include: {
              attributeValue: {
                include: {
                  attribute: true
                }
              }
            }
          },
          inventories: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      },
      sections: {
        where: { isVisible: true },
        orderBy: {
          order: "asc"
        },
        include: {
          items: {
            orderBy: {
              order: "asc"
            }
          }
        }
      }
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  return result;
};

const updateProduct = async (
  id: string,
  userId: string,
  payload: IUpdateProductRequest
): Promise<Product> => {
  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { id, isDeleted: false },
    include: {
      store: true
    }
  });

  if (!existingProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // Verify ownership
  if (existingProduct.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only update your own products"
    );
  }

  // If category is being updated, verify it exists
  if (payload.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId, isDeleted: false }
    });

    if (!category) {
      throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
    }
  }

  // If brand is being updated, verify it exists
  if (payload.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: payload.brandId, isDeleted: false }
    });

    if (!brand) {
      throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
    }
  }

  // Update slug if name is being changed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { ...payload };

  if (payload.name && payload.name !== existingProduct.name) {
    updateData.slug = await generateSlug(payload.name);
  }

  const result = await prisma.product.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
      brand: true,
      store: true,
      media: true,
      productAttributes: {
        include: {
          attribute: {
            include: {
              values: true
            }
          }
        }
      },
      variants: true
    }
  });

  return result;
};

const deleteProduct = async (id: string, userId: string): Promise<Product> => {
  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { id, isDeleted: false },
    include: {
      store: true
    }
  });

  if (!existingProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // Verify ownership
  if (existingProduct.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only delete your own products"
    );
  }

  // Soft delete
  const result = await prisma.product.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isPublished: false // Unpublish when deleted
    }
  });

  return result;
};

export const ProductService = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
};
