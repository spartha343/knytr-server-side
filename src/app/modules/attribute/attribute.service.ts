import { paginationHelpers } from "../../../helpers/paginationHelper";
import { prisma } from "../../../shared/prisma";
import { attributeSearchableFields } from "./attribute.constants";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateAttributeRequest,
  IAttributeFilterRequest,
  IUpdateAttributeRequest,
  ICreateAttributeValueRequest,
  IUpdateAttributeValueRequest
} from "./attribute.interface";
import type {
  Prisma,
  Attribute,
  AttributeValue
} from "../../../generated/prisma/client";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import type { IGenericResponse } from "../../../interfaces/common";

// ==================== ATTRIBUTE OPERATIONS ====================

const createAttribute = async (
  payload: ICreateAttributeRequest
): Promise<Attribute> => {
  // Check for duplicate name (case-insensitive)
  const existingAttribute = await prisma.attribute.findFirst({
    where: {
      name: {
        equals: payload.name,
        mode: "insensitive"
      }
    }
  });

  if (existingAttribute) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Attribute with this name already exists"
    );
  }

  const result = await prisma.attribute.create({
    data: payload,
    include: {
      values: true
    }
  });

  return result;
};

const getAllAttributes = async (
  filters: IAttributeFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<Attribute[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      OR: attributeSearchableFields.map((field) => ({
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
        // Convert string booleans to actual booleans
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value = (filterData as any)[key];
        if (value === "true") value = true;
        if (value === "false") value = false;

        return {
          [key]: {
            equals: value
          }
        };
      })
    });
  }

  const whereConditions: Prisma.AttributeWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.attribute.findMany({
    where: whereConditions,
    include: {
      values: {
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder }
  });

  const total = await prisma.attribute.count({ where: whereConditions });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const getAttributeById = async (id: string): Promise<Attribute | null> => {
  const result = await prisma.attribute.findUnique({
    where: { id },
    include: {
      values: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  return result;
};

const updateAttribute = async (
  id: string,
  payload: IUpdateAttributeRequest
): Promise<Attribute> => {
  // Check if attribute exists
  const existingAttribute = await prisma.attribute.findUnique({
    where: { id }
  });

  if (!existingAttribute) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  // Check for duplicate name (if name is being updated)
  if (payload.name && payload.name !== existingAttribute.name) {
    const duplicateAttribute = await prisma.attribute.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: "insensitive"
        },
        NOT: { id }
      }
    });

    if (duplicateAttribute) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Attribute with this name already exists"
      );
    }
  }

  const result = await prisma.attribute.update({
    where: { id },
    data: payload,
    include: {
      values: true
    }
  });

  return result;
};

const deleteAttribute = async (id: string): Promise<Attribute> => {
  // Check if attribute exists
  const existingAttribute = await prisma.attribute.findUnique({
    where: { id }
  });

  if (!existingAttribute) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  // Check if attribute is being used by any products
  const productAttributeCount = await prisma.productAttribute.count({
    where: { attributeId: id }
  });

  if (productAttributeCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot delete attribute. It is being used by ${productAttributeCount} product(s).`
    );
  }

  // Delete all attribute values first (cascade should handle this, but being explicit)
  await prisma.attributeValue.deleteMany({
    where: { attributeId: id }
  });

  // Delete attribute
  const result = await prisma.attribute.delete({
    where: { id }
  });

  return result;
};

// ==================== ATTRIBUTE VALUE OPERATIONS ====================

const createAttributeValue = async (
  payload: ICreateAttributeValueRequest
): Promise<AttributeValue> => {
  // Verify attribute exists
  const attribute = await prisma.attribute.findUnique({
    where: { id: payload.attributeId }
  });

  if (!attribute) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  // Check for duplicate value for this attribute
  const existingValue = await prisma.attributeValue.findFirst({
    where: {
      attributeId: payload.attributeId,
      value: {
        equals: payload.value,
        mode: "insensitive"
      }
    }
  });

  if (existingValue) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This value already exists for this attribute"
    );
  }

  const result = await prisma.attributeValue.create({
    data: payload,
    include: {
      attribute: true
    }
  });

  return result;
};

const getAllAttributeValues = async (
  attributeId: string
): Promise<AttributeValue[]> => {
  // Verify attribute exists
  const attribute = await prisma.attribute.findUnique({
    where: { id: attributeId }
  });

  if (!attribute) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute not found");
  }

  const result = await prisma.attributeValue.findMany({
    where: { attributeId },
    include: {
      attribute: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return result;
};

const getAttributeValueById = async (
  id: string
): Promise<AttributeValue | null> => {
  const result = await prisma.attributeValue.findUnique({
    where: { id },
    include: {
      attribute: true
    }
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute value not found");
  }

  return result;
};

const updateAttributeValue = async (
  id: string,
  payload: IUpdateAttributeValueRequest
): Promise<AttributeValue> => {
  // Check if attribute value exists
  const existingValue = await prisma.attributeValue.findUnique({
    where: { id }
  });

  if (!existingValue) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute value not found");
  }

  // Check for duplicate value (if value is being updated)
  if (payload.value && payload.value !== existingValue.value) {
    const duplicateValue = await prisma.attributeValue.findFirst({
      where: {
        attributeId: existingValue.attributeId,
        value: {
          equals: payload.value,
          mode: "insensitive"
        },
        NOT: { id }
      }
    });

    if (duplicateValue) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This value already exists for this attribute"
      );
    }
  }

  const result = await prisma.attributeValue.update({
    where: { id },
    data: payload,
    include: {
      attribute: true
    }
  });

  return result;
};

const deleteAttributeValue = async (id: string): Promise<AttributeValue> => {
  // Check if attribute value exists
  const existingValue = await prisma.attributeValue.findUnique({
    where: { id }
  });

  if (!existingValue) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attribute value not found");
  }

  // Check if value is being used by any variants
  const variantAttributeCount = await prisma.variantAttribute.count({
    where: { attributeValueId: id }
  });

  if (variantAttributeCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot delete attribute value. It is being used by ${variantAttributeCount} product variant(s).`
    );
  }

  const result = await prisma.attributeValue.delete({
    where: { id }
  });

  return result;
};

export const AttributeService = {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  getAllAttributeValues,
  getAttributeValueById,
  updateAttributeValue,
  deleteAttributeValue
};
