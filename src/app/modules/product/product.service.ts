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
const generateSlug = async (name: string, storeId: string): Promise<string> => {
  let slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Check if slug exists in this store
  const existingProduct = await prisma.product.findFirst({
    where: {
      storeId,
      slug,
      isDeleted: false
    }
  });

  if (existingProduct) {
    // Add timestamp suffix
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

  // Verify brand exists (only if brandId is provided)
  if (payload.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: payload.brandId, isDeleted: false }
    });

    if (!brand) {
      throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
    }
  }

  // Generate slug
  const slug = await generateSlug(payload.name, payload.storeId);

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
  const { searchTerm, minPrice, maxPrice, includeVariants, ...filterData } =
    filters;

  const andConditions = [];

  // Always exclude soft-deleted products
  andConditions.push({ isDeleted: false });

  // Only show products that have at least one variant
  andConditions.push({ variants: { some: {} } });

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value = (filterData as any)[key];

        // Convert string booleans to actual booleans
        if (value === "true") value = true;
        if (value === "false") value = false;

        return {
          [mappedKey as string]: {
            equals: value
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
      variants: includeVariants
        ? {
            where: { isActive: true },
            orderBy: { createdAt: "asc" as const },
            select: {
              id: true,
              sku: true,
              price: true,
              comparePrice: true,
              imageUrl: true,
              isActive: true,
              variantAttributes: {
                select: {
                  attributeValue: {
                    select: {
                      value: true,
                      attribute: {
                        select: { name: true }
                      }
                    }
                  }
                }
              },
              inventories: {
                select: {
                  quantity: true,
                  reservedQty: true
                }
              }
            }
          }
        : {
            take: 1,
            orderBy: { createdAt: "asc" as const }
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

const getVendorProducts = async (
  userId: string,
  filters: IProductFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Product[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, includeVariants, ...filterData } =
    filters;

  // Get all store IDs owned by this vendor
  const vendorStores = await prisma.store.findMany({
    where: { vendorId: userId, isDeleted: false },
    select: { id: true }
  });

  const storeIds = vendorStores.map((s) => s.id);

  if (storeIds.length === 0) {
    return { meta: { total: 0, page, limit }, data: [] };
  }

  const andConditions: Prisma.ProductWhereInput[] = [];

  // Always scope to vendor's stores
  andConditions.push({ storeId: { in: storeIds } });

  // Always exclude soft-deleted products
  andConditions.push({ isDeleted: false });

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

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: { gte?: number; lte?: number } = {};
    if (minPrice !== undefined) priceFilter.gte = minPrice;
    if (maxPrice !== undefined) priceFilter.lte = maxPrice;
    andConditions.push({ basePrice: priceFilter });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => {
        const mappedKey = productRelationalFields.includes(key)
          ? productRelationalFieldsMapper[key]
          : key;
        let value = (filterData as Record<string, unknown>)[key];
        if (value === "true") value = true;
        if (value === "false") value = false;
        return {
          [mappedKey as string]: { equals: value }
        } as Prisma.ProductWhereInput;
      })
    });
  }

  const whereConditions: Prisma.ProductWhereInput = { AND: andConditions };

  const result = await prisma.product.findMany({
    where: whereConditions,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
      store: { select: { id: true, name: true, slug: true } },
      media: { where: { isPrimary: true }, take: 1 },
      _count: {
        select: { variants: true }
      },
      variants: includeVariants
        ? {
            where: { isActive: true },
            orderBy: { createdAt: "asc" as const },
            select: {
              id: true,
              sku: true,
              price: true,
              comparePrice: true,
              imageUrl: true,
              isActive: true,
              variantAttributes: {
                select: {
                  attributeValue: {
                    select: {
                      value: true,
                      attribute: {
                        select: { name: true }
                      }
                    }
                  }
                }
              },
              inventories: {
                select: {
                  quantity: true,
                  reservedQty: true
                }
              }
            }
          }
        : { take: 1, orderBy: { price: "asc" } }
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.product.count({ where: whereConditions });

  const dataWithCount = result.map((product) => ({
    ...product,
    variantCount: product._count?.variants || 0
  }));

  return { meta: { total, page, limit }, data: dataWithCount };
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

const getProductByStoreAndSlug = async (
  storeSlug: string,
  productSlug: string
): Promise<Product | null> => {
  // First, find the store by slug
  const store = await prisma.store.findUnique({
    where: {
      slug: storeSlug,
      isDeleted: false
    }
  });

  if (!store) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `Store not found with slug: ${storeSlug}`
    );
  }

  // Then find the product by storeId and slug
  const result = await prisma.product.findFirst({
    where: {
      storeId: store.id,
      slug: productSlug,
      isDeleted: false,
      isPublished: true, // Only show published products on public pages,
      isActive: true
    },
    include: {
      category: true,
      brand: true,
      store: {
        include: {
          branches: {
            where: { isDeleted: false, isActive: true },
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
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `Product not found with slug: ${productSlug} in store: ${storeSlug}`
    );
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

  // Handle attribute updates — block if variants exist
  if (payload.attributeIds !== undefined) {
    const variantCount = await prisma.productVariant.count({
      where: { productId: id }
    });

    if (variantCount > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot change attributes on a product that already has variants. Please delete all variants first."
      );
    }

    // Replace all existing attributes
    await prisma.productAttribute.deleteMany({ where: { productId: id } });

    if (payload.attributeIds.length > 0) {
      await prisma.productAttribute.createMany({
        data: payload.attributeIds.map((attributeId) => ({
          productId: id,
          attributeId
        }))
      });
    }
  }

  // If trying to publish, validate product is ready
  if (payload.isPublished === true) {
    const activeVariants = await prisma.productVariant.findMany({
      where: { productId: id, isActive: true },
      include: {
        inventories: true
      }
    });

    if (activeVariants.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot publish a product with no active variants. Please add at least one active variant first."
      );
    }

    const hasStock = activeVariants.some((v) => v.inventories.length > 0);
    if (!hasStock) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot publish a product with zero stock. Please add inventory to at least one variant first."
      );
    }
  }

  // Update slug if name is being changed
  const updateData: Record<string, unknown> = { ...payload };

  delete updateData.attributeIds; // handled separately above

  if (payload.name && payload.name !== existingProduct.name) {
    updateData.slug = await generateSlug(payload.name, existingProduct.storeId);
  }

  // Remove nested objects and read-only fields that Prisma doesn't accept in update
  delete updateData.id;
  delete updateData.category;
  delete updateData.brand;
  delete updateData.store;
  delete updateData.media;
  delete updateData.productAttributes;
  delete updateData.variants;
  delete updateData.sections;
  delete updateData.cartItems;
  delete updateData.orderItems;
  delete updateData.createdAt;
  delete updateData.updatedAt;
  delete updateData.deletedAt;

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

const getSimilarProducts = async (
  productId: string,
  limit = 8
): Promise<Product[]> => {
  // Get the current product to know its category, brand, and store
  const currentProduct = await prisma.product.findUnique({
    where: { id: productId, isDeleted: false },
    select: {
      categoryId: true,
      brandId: true,
      storeId: true
    }
  });

  if (!currentProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const { categoryId, brandId, storeId } = currentProduct;

  // Priority 1: Same category AND same brand (but different product)
  let similarProducts = await prisma.product.findMany({
    where: {
      id: { not: productId }, // Exclude current product
      categoryId,
      brandId,
      isDeleted: false,
      isActive: true
    },
    include: {
      category: true,
      brand: true,
      store: true,
      media: {
        where: { isPrimary: true },
        take: 1
      }
    },
    orderBy: [
      { createdAt: "desc" } // Newer products first
    ],
    take: limit
  });

  // If not enough, add Priority 2: Same category only
  if (similarProducts.length < limit) {
    const sameCategoryProducts = await prisma.product.findMany({
      where: {
        id: {
          not: productId,
          notIn: similarProducts.map((p) => p.id) // Exclude already selected
        },
        categoryId,
        isDeleted: false,
        isActive: true
      },
      include: {
        category: true,
        brand: true,
        store: true,
        media: {
          where: { isPrimary: true },
          take: 1
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit - similarProducts.length
    });

    similarProducts = [...similarProducts, ...sameCategoryProducts];
  }

  // If still not enough, add Priority 3: Same brand only
  if (similarProducts.length < limit && brandId) {
    const sameBrandProducts = await prisma.product.findMany({
      where: {
        id: {
          not: productId,
          notIn: similarProducts.map((p) => p.id)
        },
        brandId,
        isDeleted: false,
        isActive: true
      },
      include: {
        category: true,
        brand: true,
        store: true,
        media: {
          where: { isPrimary: true },
          take: 1
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit - similarProducts.length
    });

    similarProducts = [...similarProducts, ...sameBrandProducts];
  }

  // If still not enough, add Priority 4: Same store (popular products)
  if (similarProducts.length < limit) {
    const sameStoreProducts = await prisma.product.findMany({
      where: {
        id: {
          not: productId,
          notIn: similarProducts.map((p) => p.id)
        },
        storeId,
        isDeleted: false,
        isActive: true
      },
      include: {
        category: true,
        brand: true,
        store: true,
        media: {
          where: { isPrimary: true },
          take: 1
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit - similarProducts.length
    });

    similarProducts = [...similarProducts, ...sameStoreProducts];
  }

  return similarProducts;
};

export const ProductService = {
  createProduct,
  getAllProducts,
  getVendorProducts,
  getProductById,
  getProductByStoreAndSlug,
  updateProduct,
  deleteProduct,
  getSimilarProducts
};
