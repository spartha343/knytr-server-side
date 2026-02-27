import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import PathaoService from "./pathao.service";
import PathaoLocationService from "./pathao-location.service";
import ApiError from "../../../errors/ApiError";
import { prisma } from "../../../shared/prisma";
import crypto from "crypto";

// Save Pathao API credentials
const saveCredentials = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await PathaoService.saveCredentials(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Pathao credentials saved successfully",
    data: result
  });
});

const getCredentialsByBranch = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.dbUser?.id;

    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
    }

    const { branchId } = req.params;

    if (!branchId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
    }

    // Get credentials for this branch
    const credentials = await prisma.pathaoCredential.findUnique({
      where: { branchId },
      select: {
        id: true,
        clientId: true,
        branchId: true,
        clientSecret: true,
        username: true,
        environment: true,
        webhookSecret: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true
        // Note: password, accessToken, refreshToken, tokenExpiry are excluded for security
      }
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: credentials
        ? "Credentials fetched successfully"
        : "No credentials found for this branch",
      data: credentials
    });
  }
);

// Register store with Pathao
const registerStore = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  // Get branchId from request body
  const { branchId, ...storeData } = req.body;

  if (!branchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  const result = await PathaoService.registerStore(branchId, storeData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Store registered with Pathao successfully",
    data: result
  });
});

// Sync locations from Pathao API
const syncLocations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  // Extract options from query parameters
  const fullSync = req.query.fullSync === "true";
  const maxZones = req.query.maxZones
    ? parseInt(req.query.maxZones as string)
    : 3;
  const delayBetweenCities = req.query.delayBetweenCities
    ? parseInt(req.query.delayBetweenCities as string)
    : 3000;
  const delayBetweenZones = req.query.delayBetweenZones
    ? parseInt(req.query.delayBetweenZones as string)
    : 3000;

  const result = await PathaoLocationService.syncAllLocations({
    fullSync,
    maxZones,
    delayBetweenCities,
    delayBetweenZones
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Locations synced successfully",
    data: result
  });
});

// Batch sync areas (process zones in batches)
const syncAreasBatch = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const batchSize = req.query.batchSize
    ? parseInt(req.query.batchSize as string)
    : 50;
  const startFromZoneId = req.query.startFromZoneId
    ? parseInt(req.query.startFromZoneId as string)
    : 0;
  const delayBetweenZones = req.query.delayBetweenZones
    ? parseInt(req.query.delayBetweenZones as string)
    : 3000;

  const result = await PathaoLocationService.syncAreasBatch({
    batchSize,
    startFromZoneId,
    delayBetweenZones
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Batch sync completed successfully",
    data: result
  });
});

// Get sync progress
const getSyncProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await PathaoLocationService.getSyncProgress();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sync progress retrieved successfully",
    data: result
  });
});

// Get all cities (Public - no auth needed)
const getCities = catchAsync(async (req: Request, res: Response) => {
  // Query database directly for all cities
  const result = await prisma.pathaoCity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cities fetched successfully",
    data: result
  });
});

// Get zones by city (Public - no auth needed)
const getZones = catchAsync(async (req: Request, res: Response) => {
  const { cityId } = req.params;

  if (!cityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "City ID is required");
  }

  const result = await PathaoLocationService.getZonesByCity(parseInt(cityId));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Zones fetched successfully",
    data: result
  });
});

// Get areas by zone (Public - no auth needed)
const getAreas = catchAsync(async (req: Request, res: Response) => {
  const { zoneId } = req.params;

  if (!zoneId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Zone ID is required");
  }

  const result = await PathaoLocationService.getAreasByZone(parseInt(zoneId));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Areas fetched successfully",
    data: result
  });
});

// Handle Pathao webhook (Public - but verify signature)
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const webhookData = req.body;

  if (!webhookData) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid webhook payload");
  }

  // Handle webhook integration test — no signature check needed here
  // Pathao just wants 202 + the integration secret header back
  if (webhookData.event === "webhook_integration") {
    // For integration test, use any active credential's webhookSecret
    // (Pathao only sends integration test once during setup)
    const credentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true, webhookSecret: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { webhookSecret: true }
    });

    res.setHeader(
      "X-Pathao-Merchant-Webhook-Integration-Secret",
      credentials?.webhookSecret || ""
    );
    return sendResponse(res, {
      statusCode: httpStatus.ACCEPTED,
      success: true,
      message: "Webhook integration verified",
      data: null
    });
  }

  // For real events — look up the correct branch's webhookSecret
  // via: consignment_id → PathaoDelivery → PathaoStore → Branch → PathaoCredential
  const consignmentId = webhookData.consignment_id as string | undefined;

  if (consignmentId) {
    const delivery = await prisma.pathaoDelivery.findUnique({
      where: { consignmentId },
      select: {
        pathaoStore: {
          select: {
            branch: {
              select: {
                pathaoCredentials: {
                  select: { webhookSecret: true }
                }
              }
            }
          }
        }
      }
    });

    const webhookSecret =
      delivery?.pathaoStore?.branch?.pathaoCredentials?.webhookSecret;

    if (webhookSecret) {
      const receivedSignature = req.headers["x-pathao-signature"] as string;

      if (!receivedSignature) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "Missing webhook signature"
        );
      }

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (receivedSignature !== expectedSignature) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "Invalid webhook signature"
        );
      }
    }
  }

  // Process webhook
  await PathaoService.handleWebhook(webhookData);

  // Pathao expects 202 status
  sendResponse(res, {
    statusCode: httpStatus.ACCEPTED,
    success: true,
    message: "Webhook processed successfully",
    data: null
  });
});

const getAllDeliveries = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const { status, storeId, fromDate, toDate } = req.query;

  const filters: {
    status?: string;
    storeId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {};

  if (status) filters.status = status as string;
  if (storeId) filters.storeId = storeId as string;
  if (fromDate) filters.fromDate = new Date(fromDate as string);
  if (toDate) filters.toDate = new Date(toDate as string);

  const result = await PathaoService.getAllDeliveries(filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Deliveries fetched successfully",
    data: result
  });
});

// Get delivery by ID (Admin/Vendor)
const getDeliveryById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Delivery ID is required");
  }

  const result = await PathaoService.getDeliveryById(id);

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Delivery not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery fetched successfully",
    data: result
  });
});

// Fetch delivery status from Pathao API (Admin/Vendor)
const fetchDeliveryStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const { consignmentId, branchId } = req.params;

  if (!consignmentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Consignment ID is required");
  }

  if (!branchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch ID is required");
  }

  const result = await PathaoService.fetchDeliveryStatus(
    branchId,
    consignmentId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery status fetched successfully",
    data: result
  });
});
// Get all stores (Admin/Vendor)
const getAllStores = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const result = await PathaoService.getAllStores();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stores fetched successfully",
    data: result
  });
});

// Retry failed delivery (Admin/Vendor)
const retryDelivery = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Delivery ID is required");
  }

  const result = await PathaoService.retryDelivery(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery retry initiated successfully",
    data: result
  });
});

// Sync delivery status from Pathao API (manual trigger)
const syncDeliveryStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const { orderId } = req.params;

  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Order ID is required");
  }

  const result = await PathaoService.syncDeliveryStatus(orderId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery status synced successfully",
    data: result
  });
});

// Create delivery for a specific order (manual trigger)
const createDeliveryForOrder = catchAsync(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { recipientCityId, recipientZoneId, recipientAreaId } = req.body;

    if (!orderId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Order id is required!");
    }

    // First, update the order with Pathao location information
    await prisma.order.update({
      where: { id: orderId },
      data: {
        recipientCityId,
        recipientZoneId,
        recipientAreaId
      }
    });

    // Then create the delivery
    const result = await PathaoService.createDeliveryForOrder(orderId);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Pathao delivery created successfully",
      data: result
    });
  }
);

const getStoreByBranch = catchAsync(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  if (!branchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Branch id is required");
  }
  const result = await PathaoService.getStoreByBranch(branchId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Pathao store fetched successfully",
    data: result
  });
});

export const PathaoController = {
  saveCredentials,
  getCredentialsByBranch,
  registerStore,
  syncLocations,
  syncAreasBatch,
  getSyncProgress,
  getCities,
  getZones,
  getAreas,
  handleWebhook,
  getAllDeliveries,
  getDeliveryById,
  fetchDeliveryStatus,
  syncDeliveryStatus,
  getAllStores,
  retryDelivery,
  createDeliveryForOrder,
  getStoreByBranch
};
