import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AttributeService } from "./attribute.service";
import pick from "../../../shared/pick";
import { attributeFilterableFields } from "./attribute.constants";
import ApiError from "../../../errors/ApiError";

// ==================== ATTRIBUTE CONTROLLERS ====================

const createAttribute = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.createAttribute(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attribute created successfully",
    data: result
  });
});

const getAllAttributes = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, attributeFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AttributeService.getAllAttributes(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attributes retrieved successfully",
    meta: result.meta,
    data: result.data
  });
});

const getAttributeById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Attribute ID is required");
  }

  const result = await AttributeService.getAttributeById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute retrieved successfully",
    data: result
  });
});

const updateAttribute = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Attribute ID is required");
  }

  const result = await AttributeService.updateAttribute(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute updated successfully",
    data: result
  });
});

const deleteAttribute = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Attribute ID is required");
  }

  const result = await AttributeService.deleteAttribute(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute deleted successfully",
    data: result
  });
});

// ==================== ATTRIBUTE VALUE CONTROLLERS ====================

const createAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.createAttributeValue(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attribute value created successfully",
    data: result
  });
});

const getAllAttributeValues = catchAsync(
  async (req: Request, res: Response) => {
    const { attributeId } = req.params;

    if (!attributeId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Attribute ID is required");
    }

    const result = await AttributeService.getAllAttributeValues(attributeId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute values retrieved successfully",
      data: result
    });
  }
);

const getAttributeValueById = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Attribute value ID is required"
      );
    }

    const result = await AttributeService.getAttributeValueById(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute value retrieved successfully",
      data: result
    });
  }
);

const updateAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Attribute value ID is required"
    );
  }

  const result = await AttributeService.updateAttributeValue(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute value updated successfully",
    data: result
  });
});

const deleteAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Attribute value ID is required"
    );
  }

  const result = await AttributeService.deleteAttributeValue(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute value deleted successfully",
    data: result
  });
});

export const AttributeController = {
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
