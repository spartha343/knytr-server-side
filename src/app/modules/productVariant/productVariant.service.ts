import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateProductVariantRequest,
  IUpdateProductVariantRequest,
  IBulkCreateVariantsRequest
} from "./productVariant.interface";
import type { ProductVariant } from "../../../generated/prisma/client";

const createProductVariant = async (
  userId: string,
  payload: ICreateProductVariantRequest
): Promise<ProductVariant> => {
  // Verify product exists and user owns it
  const product = await prisma.product.findUnique({
    where: { id: payload.productId, isDeleted: false },
    include: {
      store: true,
      productAttributes: true
    }
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  if (product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only create variants for your own products"
    );
  }

  // Check SKU uniqueness
  const existingSKU = await prisma.productVariant.findUnique({
    where: { sku: payload.sku }
  });

  if (existingSKU) {
    throw new ApiError(httpStatus.BAD_REQUEST, "SKU already exists");
  }

  // Verify all attribute values exist and belong to product's attributes
  const productAttributeIds = product.productAttributes.map(
    (pa) => pa.attributeId
  );

  const attributeValues = await prisma.attributeValue.findMany({
    where: {
      id: { in: payload.attributeValueIds }
    },
    include: {
      attribute: true
    }
  });

  if (attributeValues.length !== payload.attributeValueIds.length) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "One or more attribute values not found"
    );
  }

  // Verify all attribute values belong to product's attributes
  const usedAttributeIds = attributeValues.map((av) => av.attributeId);
  const invalidAttributes = usedAttributeIds.filter(
    (id) => !productAttributeIds.includes(id)
  );

  if (invalidAttributes.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Attribute values must belong to product's attributes"
    );
  }

  // Check for duplicate variant (same attribute value combination)
  const existingVariants = await prisma.productVariant.findMany({
    where: {
      productId: payload.productId
    },
    include: {
      variantAttributes: true
    }
  });

  for (const existingVariant of existingVariants) {
    const existingAttrValueIds = existingVariant.variantAttributes
      .map((va) => va.attributeValueId)
      .sort();
    const newAttrValueIds = payload.attributeValueIds.sort();

    if (
      JSON.stringify(existingAttrValueIds) === JSON.stringify(newAttrValueIds)
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "A variant with this attribute combination already exists"
      );
    }
  }

  // Create variant with attribute associations
  const { attributeValueIds, ...variantData } = payload;

  const result = await prisma.productVariant.create({
    data: {
      ...variantData,
      variantAttributes: {
        create: attributeValueIds.map((attributeValueId) => ({
          attributeValueId
        }))
      }
    },
    include: {
      product: true,
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
          branch: true
        }
      }
    }
  });

  return result;
};

const bulkCreateProductVariants = async (
  userId: string,
  payload: IBulkCreateVariantsRequest
): Promise<ProductVariant[]> => {
  // Verify product exists and user owns it
  const product = await prisma.product.findUnique({
    where: { id: payload.productId, isDeleted: false },
    include: {
      store: true,
      productAttributes: true
    }
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  if (product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only create variants for your own products"
    );
  }

  const productAttributeIds = product.productAttributes.map(
    (pa) => pa.attributeId
  );

  // Validate all SKUs are unique
  const skus = payload.variants.map((v) => v.sku);
  const duplicateSKUs = skus.filter(
    (sku, index) => skus.indexOf(sku) !== index
  );

  if (duplicateSKUs.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Duplicate SKUs in request: ${duplicateSKUs.join(", ")}`
    );
  }

  // Check if any SKU already exists
  const existingSKUs = await prisma.productVariant.findMany({
    where: {
      sku: { in: skus }
    }
  });

  if (existingSKUs.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `SKUs already exist: ${existingSKUs.map((v) => v.sku).join(", ")}`
    );
  }

  // Collect all attribute value IDs from all variants
  const allAttributeValueIds = Array.from(
    new Set(payload.variants.flatMap((v) => v.attributeValueIds))
  );

  // Verify all attribute values exist
  const attributeValues = await prisma.attributeValue.findMany({
    where: {
      id: { in: allAttributeValueIds }
    },
    include: {
      attribute: true
    }
  });

  if (attributeValues.length !== allAttributeValueIds.length) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "One or more attribute values not found"
    );
  }

  // Verify all attribute values belong to product's attributes
  const invalidAttributes = attributeValues.filter(
    (av) => !productAttributeIds.includes(av.attributeId)
  );

  if (invalidAttributes.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "All attribute values must belong to product's attributes"
    );
  }

  // Create all variants in a transaction
  const results: ProductVariant[] = [];

  for (const variantData of payload.variants) {
    const { attributeValueIds, ...data } = variantData;

    const variant = await prisma.productVariant.create({
      data: {
        ...data,
        productId: payload.productId,
        variantAttributes: {
          create: attributeValueIds.map((attributeValueId) => ({
            attributeValueId
          }))
        }
      },
      include: {
        product: true,
        variantAttributes: {
          include: {
            attributeValue: {
              include: {
                attribute: true
              }
            }
          }
        }
      }
    });

    results.push(variant);
  }

  return results;
};

const getProductVariants = async (
  productId: string
): Promise<ProductVariant[]> => {
  const product = await prisma.product.findUnique({
    where: { id: productId, isDeleted: false }
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const result = await prisma.productVariant.findMany({
    where: { productId },
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
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return result;
};

const getVariantById = async (id: string): Promise<ProductVariant | null> => {
  const result = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          category: true,
          brand: true,
          store: {
            include: {
              branches: {
                where: { isDeleted: false }
              }
            }
          }
        }
      },
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
          branch: true
        }
      }
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  return result;
};

const updateProductVariant = async (
  id: string,
  userId: string,
  payload: IUpdateProductVariantRequest
): Promise<ProductVariant> => {
  const existingVariant = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          store: true
        }
      }
    }
  });

  if (!existingVariant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  if (existingVariant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only update your own product variants"
    );
  }

  // Check SKU uniqueness if being updated
  if (payload.sku && payload.sku !== existingVariant.sku) {
    const duplicateSKU = await prisma.productVariant.findUnique({
      where: { sku: payload.sku }
    });

    if (duplicateSKU) {
      throw new ApiError(httpStatus.BAD_REQUEST, "SKU already exists");
    }
  }

  const result = await prisma.productVariant.update({
    where: { id },
    data: payload,
    include: {
      product: true,
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
          branch: true
        }
      }
    }
  });

  return result;
};

const deleteProductVariant = async (
  id: string,
  userId: string
): Promise<ProductVariant> => {
  const existingVariant = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          store: true
        }
      }
    }
  });

  if (!existingVariant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  if (existingVariant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only delete your own product variants"
    );
  }

  // Delete variant (cascade will handle variantAttributes and inventories)
  const result = await prisma.productVariant.delete({
    where: { id }
  });

  return result;
};

export const ProductVariantService = {
  createProductVariant,
  bulkCreateProductVariants,
  getProductVariants,
  getVariantById,
  updateProductVariant,
  deleteProductVariant
};
