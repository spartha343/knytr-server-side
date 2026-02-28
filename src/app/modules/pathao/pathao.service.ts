/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import axios, { type AxiosInstance } from "axios";
import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  PathaoCredential,
  PathaoStore,
  PathaoDelivery,
  Order,
  Branch,
  Prisma
} from "../../../generated/prisma/client";
import { OrderStatus } from "../../../generated/prisma/client";
import {
  type IPathaoAuthRequest,
  type IPathaoAuthResponse,
  type IPathaoCityResponse,
  type IPathaoZoneResponse,
  type IPathaoAreaResponse,
  type IPathaoStoreCreateRequest,
  type IPathaoStoreResponse,
  type IPathaoPriceCalculationRequest,
  type IPathaoPriceCalculationResponse,
  type IPathaoOrderCreateRequest,
  type IPathaoOrderCreateResponse,
  type IPathaoOrderStatusResponse,
  type IPathaoWebhookPayload,
  type IPathaoCredentialsInput,
  type ICreatePathaoDeliveryRequest,
  PathaoApiError,
  PathaoDeliveryStatus,
  PathaoDeliveryType,
  PathaoItemType,
  type IPathaoStoresListResponse
} from "./pathao.interface";
import { pathaoErrorMessages } from "./pathao.constants";

// Some types are imported for future use and type safety

class PathaoService {
  private tokenCache = new Map<string, { token: string; expiryTime: number }>();
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }

  // ============================================
  // HELPER: Get Base URL
  // ============================================

  private async getBaseUrl(branchId: string): Promise<string> {
    const credentials = await this.getCredentialsByBranch(branchId);
    if (!credentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    return credentials.environment === "sandbox"
      ? "https://courier-api-sandbox.pathao.com/aladdin/api/v1"
      : "https://api-hermes.pathao.com/aladdin/api/v1";
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private async authenticate(branchId: string): Promise<string> {
    // Check in-memory cache first (skip DB query if still valid)
    const cached = this.tokenCache.get(branchId);
    if (cached) {
      const bufferTime = 5 * 60 * 1000; // 5 min buffer
      if (Date.now() < cached.expiryTime - bufferTime) {
        return cached.token;
      }
    }

    const credentials = await this.getCredentialsByBranch(branchId);
    if (!credentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    // Check DB token
    if (credentials.accessToken && credentials.tokenExpiry) {
      const now = new Date();
      const expiryBuffer = new Date(
        credentials.tokenExpiry.getTime() - 5 * 60 * 1000
      );

      if (now < expiryBuffer) {
        // Token still valid — update in-memory cache and return
        this.tokenCache.set(branchId, {
          token: credentials.accessToken,
          expiryTime: credentials.tokenExpiry.getTime()
        });
        return credentials.accessToken;
      }

      // Token expired — try refresh token first
      if (credentials.refreshToken) {
        try {
          return await this.refreshAccessToken(credentials);
        } catch (error) {
          // Refresh failed, fall through to password grant
          // eslint-disable-next-line no-console
          console.error("Refresh token failed, using password grant:", error);
        }
      }
    }

    // Issue new token with password grant
    return await this.issueNewToken(credentials);
  }

  private async issueNewToken(credentials: PathaoCredential): Promise<string> {
    const baseUrl = await this.getBaseUrl(credentials.branchId);

    const authPayload: IPathaoAuthRequest = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
      grant_type: "password"
    };

    try {
      const response = await this.axiosInstance.post<IPathaoAuthResponse>(
        `${baseUrl.replace("/aladdin/api/v1", "")}/aladdin/api/v1/issue-token`,
        authPayload
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const tokenExpiry = new Date(Date.now() + expires_in * 1000);

      // Store tokens in database
      await prisma.pathaoCredential.update({
        where: { id: credentials.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          lastUsedAt: new Date()
        }
      });

      // Cache in memory
      this.tokenCache.set(credentials.branchId, {
        token: access_token,
        expiryTime: tokenExpiry.getTime()
      });

      return access_token;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          pathaoErrorMessages.AUTH_FAILED,
          "AUTH_FAILED",
          { error: error.response?.data },
          false
        );
      }
      throw error;
    }
  }

  private async refreshAccessToken(
    credentials: PathaoCredential
  ): Promise<string> {
    const baseUrl = await this.getBaseUrl(credentials.branchId);

    const authPayload = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken
    };

    try {
      const response = await this.axiosInstance.post<IPathaoAuthResponse>(
        `${baseUrl.replace("/aladdin/api/v1", "")}/aladdin/api/v1/issue-token`,
        authPayload
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const tokenExpiry = new Date(Date.now() + expires_in * 1000);

      // Store new tokens in database
      await prisma.pathaoCredential.update({
        where: { id: credentials.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          lastUsedAt: new Date()
        }
      });

      // Cache in memory
      this.tokenCache.set(credentials.branchId, {
        token: access_token,
        expiryTime: tokenExpiry.getTime()
      });

      return access_token;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to refresh access token",
          "REFRESH_TOKEN_FAILED",
          { error: error.response?.data },
          false
        );
      }
      throw error;
    }
  }

  private async getAuthHeaders(
    branchId: string
  ): Promise<Record<string, string>> {
    const token = await this.authenticate(branchId);
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  // ============================================
  // MASTER DATA: Cities, Zones, Areas
  // ============================================

  async getCities(): Promise<IPathaoCityResponse> {
    const anyCredentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true }
    });

    if (!anyCredentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    const baseUrl = await this.getBaseUrl(anyCredentials.branchId);
    const headers = await this.getAuthHeaders(anyCredentials.branchId);

    try {
      const response = await this.axiosInstance.get<IPathaoCityResponse>(
        `${baseUrl}/city-list`,
        { headers }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to fetch cities",
          "FETCH_CITIES_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  async getZones(cityId: number): Promise<IPathaoZoneResponse> {
    // For global operations, we can use any branch's credentials
    const anyCredentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true }
    });

    if (!anyCredentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    const baseUrl = await this.getBaseUrl(anyCredentials.branchId);
    const headers = await this.getAuthHeaders(anyCredentials.branchId);

    try {
      const response = await this.axiosInstance.get<IPathaoZoneResponse>(
        `${baseUrl}/cities/${cityId}/zone-list`,
        { headers }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to fetch zones",
          "FETCH_ZONES_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  async getAreas(zoneId: number): Promise<IPathaoAreaResponse> {
    const anyCredentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true }
    });

    if (!anyCredentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    const baseUrl = await this.getBaseUrl(anyCredentials.branchId);
    const headers = await this.getAuthHeaders(anyCredentials.branchId);

    try {
      const response = await this.axiosInstance.get<IPathaoAreaResponse>(
        `${baseUrl}/zones/${zoneId}/area-list`,
        { headers }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to fetch areas",
          "FETCH_AREAS_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  // ============================================
  // STORE MANAGEMENT
  // ============================================

  async registerStore(
    branchId: string,
    storeData: {
      name: string;
      contactName: string;
      contactNumber: string;
      secondaryContact?: string;
      otpNumber?: string;
      cityId: number;
      zoneId: number;
      areaId: number;
    }
  ): Promise<PathaoStore> {
    // Get branch with address
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { address: true }
    });

    if (!branch || !branch.address) {
      throw new ApiError(httpStatus.NOT_FOUND, "Branch or address not found");
    }

    // Check if store already registered
    const existingStore = await prisma.pathaoStore.findUnique({
      where: { branchId }
    });

    if (existingStore) {
      // Update local record only — Pathao doesn't support store updates via API
      const updatedStore = await prisma.pathaoStore.update({
        where: { branchId },
        data: {
          name: String(storeData.name),
          contactName: String(storeData.contactName),
          contactNumber: String(storeData.contactNumber),
          secondaryContact: storeData.secondaryContact ?? null,
          cityId: storeData.cityId,
          zoneId: storeData.zoneId,
          areaId: storeData.areaId
        }
      });
      return updatedStore;
    }

    if (!storeData.name || !storeData.contactName || !storeData.contactNumber) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Store name, contact name, and contact number are required"
      );
    }

    const baseUrl = await this.getBaseUrl(branchId);
    const headers = await this.getAuthHeaders(branchId);

    // Get location IDs - for now require them in storeData
    // TODO: In future, implement smart address-to-location mapping
    if (!storeData.cityId || !storeData.zoneId || !storeData.areaId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "City, Zone, and Area IDs are required. Please select from Pathao location master data."
      );
    }

    // Build a full address from available fields (min 15, max 120 chars)
    const addressParts = [
      branch.address.addressLine1,
      branch.address.addressLine2,
      branch.address.city,
      branch.address.state
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ").substring(0, 120);

    const payload: IPathaoStoreCreateRequest = {
      name: String(storeData.name),
      contact_name: String(storeData.contactName),
      contact_number: String(storeData.contactNumber),
      address: fullAddress,
      city_id: storeData.cityId,
      zone_id: storeData.zoneId,
      area_id: storeData.areaId,
      ...(storeData.secondaryContact && {
        secondary_contact: storeData.secondaryContact
      }),
      ...(storeData.otpNumber && { otp_number: storeData.otpNumber })
    };

    try {
      // Step 1: Register store with Pathao
      const response = await this.axiosInstance.post<IPathaoStoreResponse>(
        `${baseUrl}/stores`,
        payload,
        { headers }
      );

      // eslint-disable-next-line no-console
      console.log(
        "Pathao Store Registration successful:",
        response.data.message
      );

      // Step 2: Fetch stores list to get the store_id
      // Wait a bit for Pathao to process (sometimes takes a second)
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay

      const storesListResponse = await this.fetchPathaoStores(branchId);

      // Step 3: Find our newly created store by name
      const newStore = storesListResponse.data.data.find(
        (store) => store.store_name === storeData.name
      );

      if (!newStore) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          `Store registered with Pathao but could not find store_id. Please check Pathao dashboard manually. Store name:
${storeData.name}`
        );
      }

      // eslint-disable-next-line no-console
      console.log(`Found store_id from Pathao: ${newStore.store_id}`);

      // Step 4: Save to database with real store_id
      const pathaoStore = await prisma.pathaoStore.create({
        data: {
          branchId,
          pathaoStoreId: newStore.store_id,
          name: String(storeData.name),
          contactName: String(storeData.contactName),
          contactNumber: String(storeData.contactNumber),
          secondaryContact: storeData.secondaryContact ?? null,
          address: branch.address.addressLine1,
          cityId: storeData.cityId,
          zoneId: storeData.zoneId,
          areaId: storeData.areaId,
          isActive: newStore.is_active === 1 // Use Pathao's active status
        }
      });

      return pathaoStore;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        // eslint-disable-next-line no-console
        console.error(
          "Pathao Store Registration Error:",
          JSON.stringify(error.response?.data, null, 2)
        );
        throw new PathaoApiError(
          pathaoErrorMessages.STORE_REGISTRATION_FAILED,
          "STORE_REGISTRATION_FAILED",
          { error: error.response?.data },
          true
        );
      }
      throw error;
    }
  }

  async linkExistingStore(
    branchId: string,
    data: {
      pathaoStoreId: number;
      name: string;
      contactName: string;
      contactNumber: string;
      secondaryContact?: string;
      address: string;
      cityId: number;
      zoneId: number;
      areaId: number;
    }
  ): Promise<PathaoStore> {
    const existing = await prisma.pathaoStore.findUnique({
      where: { branchId }
    });

    if (existing) {
      return await prisma.pathaoStore.update({
        where: { branchId },
        data: {
          pathaoStoreId: data.pathaoStoreId,
          name: data.name,
          contactName: data.contactName,
          contactNumber: data.contactNumber,
          secondaryContact: data.secondaryContact ?? null,
          address: data.address,
          cityId: data.cityId,
          zoneId: data.zoneId,
          areaId: data.areaId,
          isActive: true
        }
      });
    }

    return await prisma.pathaoStore.create({
      data: {
        branchId,
        pathaoStoreId: data.pathaoStoreId,
        name: data.name,
        contactName: data.contactName,
        contactNumber: data.contactNumber,
        secondaryContact: data.secondaryContact ?? null,
        address: data.address,
        cityId: data.cityId,
        zoneId: data.zoneId,
        areaId: data.areaId,
        isActive: true
      }
    });
  }

  // Helper: Fetch stores from Pathao to get the store_id
  private async fetchPathaoStores(
    branchId: string
  ): Promise<IPathaoStoresListResponse> {
    const baseUrl = await this.getBaseUrl(branchId);
    const headers = await this.getAuthHeaders(branchId);

    try {
      const response = await this.axiosInstance.get<IPathaoStoresListResponse>(
        `${baseUrl}/stores`,
        { headers }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to fetch Pathao stores",
          "FETCH_STORES_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  // ============================================
  // PRICE CALCULATION
  // ============================================

  async calculateDeliveryCharge(orderId: string): Promise<number> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignedBranch: {
          include: {
            pathaoStore: true
          }
        },
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    if (!order) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        pathaoErrorMessages.ORDER_NOT_FOUND
      );
    }

    // Get branch with Pathao store
    if (!order.assignedBranch || !order.assignedBranch.pathaoStore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        order.assignedBranch
          ? pathaoErrorMessages.STORE_NOT_REGISTERED
          : "Order has no assigned branch."
      );
    }

    const pathaoStore = order.assignedBranch.pathaoStore;
    const branchId = order.assignedBranch.id;

    // Calculate total weight
    let rawWeight = 0;
    order.items.forEach((item) => {
      const weight = item.product?.weight || 0.5;
      rawWeight += Number(weight) * item.quantity;
    });
    // Clamp weight to Pathao's allowed range: min 0.5kg, max 10kg
    const totalWeight = Math.min(Math.max(rawWeight, 0.5), 10);

    const baseUrl = await this.getBaseUrl(branchId);
    const headers = await this.getAuthHeaders(branchId);

    if (!order.recipientCityId || !order.recipientZoneId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Order must have Pathao location information (recipientCityId, recipientZoneId) to calculate delivery charge."
      );
    }

    const payload: IPathaoPriceCalculationRequest = {
      store_id: pathaoStore.pathaoStoreId,
      delivery_type: PathaoDeliveryType.NORMAL,
      item_type: PathaoItemType.PARCEL,
      item_weight: totalWeight,
      recipient_city: order.recipientCityId,
      recipient_zone: order.recipientZoneId
    };

    try {
      const response =
        await this.axiosInstance.post<IPathaoPriceCalculationResponse>(
          `${baseUrl}/merchant/price-plan`,
          payload,
          { headers }
        );

      return response.data.data.price;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          pathaoErrorMessages.PRICE_CALCULATION_FAILED,
          "PRICE_CALCULATION_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  // ============================================
  // ORDER CREATION
  // ============================================

  async createDelivery(
    payload: ICreatePathaoDeliveryRequest
  ): Promise<PathaoDelivery> {
    const { orderId } = payload;

    // Get order with all details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignedBranch: {
          include: {
            pathaoStore: true
          }
        },
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    if (!order) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        pathaoErrorMessages.ORDER_NOT_FOUND
      );
    }

    // Validate existing delivery
    const existingDelivery = await prisma.pathaoDelivery.findUnique({
      where: { orderId }
    });

    if (existingDelivery) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.DELIVERY_ALREADY_EXISTS
      );
    }

    // Validate required order fields
    if (!order.customerName || !order.customerPhone || !order.deliveryAddress) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Order must have customer name, phone, and delivery address to create Pathao delivery"
      );
    }

    // Use the order's assigned branch
    if (!order.assignedBranch || !order.assignedBranch.pathaoStore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        order.assignedBranch
          ? pathaoErrorMessages.STORE_NOT_REGISTERED
          : "Order has no assigned branch. Please assign a branch before booking Pathao delivery."
      );
    }

    const pathaoStore = order.assignedBranch.pathaoStore;
    const branchId = order.assignedBranch.id;

    // Calculate total weight
    let rawWeight = 0;
    let itemDescription = "";
    order.items.forEach((item, index) => {
      const weight = item.product?.weight || 0.5;
      rawWeight += Number(weight) * item.quantity;
      if (index > 0) itemDescription += ", ";
      itemDescription += `${item.product?.name || "Product"} x${item.quantity}`;
    });
    // Clamp weight to Pathao's allowed range: min 0.5kg, max 10kg
    const totalWeight = Math.min(Math.max(rawWeight, 0.5), 10);

    // Determine amount to collect: only for COD orders
    const amountToCollect =
      order.paymentMethod === "COD" ? Number(order.totalAmount) : 0;

    const baseUrl = await this.getBaseUrl(branchId);
    const headers = await this.getAuthHeaders(branchId);

    // Get location IDs from order (if provided) or throw error
    if (
      !order.recipientCityId ||
      !order.recipientZoneId ||
      !order.recipientAreaId
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Order must have Pathao location information (recipientCityId, recipientZoneId, recipientAreaId) to create delivery."
      );
    }

    const recipientCityId = order.recipientCityId;
    const recipientZoneId = order.recipientZoneId;
    const recipientAreaId = order.recipientAreaId;

    // Create delivery record in database first
    const delivery = await prisma.pathaoDelivery.create({
      data: {
        orderId,
        pathaoStoreId: pathaoStore.id,
        status: "CREATING",
        recipientCityId: recipientCityId,
        recipientZoneId: recipientZoneId,
        recipientAreaId: recipientAreaId,
        recipientName: order.customerName,
        recipientPhone: order.customerPhone,
        recipientAddress: order.deliveryAddress,
        itemWeight: totalWeight,
        itemQuantity: order.items.length,
        amountToCollect: amountToCollect,
        deliveryType: PathaoDeliveryType.NORMAL,
        itemType: PathaoItemType.PARCEL,
        itemDescription: itemDescription.substring(0, 255)
      }
    });

    const orderPayload: IPathaoOrderCreateRequest = {
      store_id: pathaoStore.pathaoStoreId,
      merchant_order_id: order.orderNumber,
      recipient_name: order.customerName,
      recipient_phone: order.customerPhone,
      ...(order.secondaryPhone && {
        recipient_secondary_phone: order.secondaryPhone
      }),
      recipient_address: order.deliveryAddress,
      delivery_type: PathaoDeliveryType.NORMAL,
      item_type: PathaoItemType.PARCEL,
      item_quantity: order.items.length,
      item_weight: totalWeight,
      item_description: itemDescription,
      ...(order.specialInstructions && {
        special_instruction: order.specialInstructions
      }),
      amount_to_collect: amountToCollect,
      recipient_city: recipientCityId,
      recipient_zone: recipientZoneId,
      recipient_area: recipientAreaId
    };

    try {
      const response =
        await this.axiosInstance.post<IPathaoOrderCreateResponse>(
          `${baseUrl}/orders`,
          orderPayload,
          { headers }
        );

      const pathaoData = response.data.data;

      // Update delivery with Pathao response
      const updatedDelivery = await prisma.pathaoDelivery.update({
        where: { id: delivery.id },
        data: {
          consignmentId: pathaoData.consignment_id,
          invoiceId: pathaoData.invoice_id,
          status: "CREATED"
        }
      });

      // Create status history
      await prisma.pathaoDeliveryStatusHistory.create({
        data: {
          pathaoDeliveryId: delivery.id,
          status: "CREATED",
          remarks: "Delivery created successfully"
        }
      });

      return updatedDelivery;
    } catch (error: unknown) {
      // Update delivery status to FAILED
      await prisma.pathaoDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          errorMessage: axios.isAxiosError(error)
            ? JSON.stringify(error.response?.data)
            : "Unknown error",
          retryCount: { increment: 1 },
          lastRetryAt: new Date()
        }
      });

      if (axios.isAxiosError(error)) {
        // Extract validation errors from Pathao response
        const pathaoError = error.response?.data;
        let errorMessage = pathaoErrorMessages.ORDER_CREATION_FAILED;

        if (pathaoError?.errors) {
          const validationMessages = Object.entries(pathaoError.errors)
            .map(
              ([field, messages]) =>
                `${field}: ${(messages as string[]).join(", ")}`
            )
            .join("; ");
          errorMessage = `Pathao validation failed — ${validationMessages}`;
        } else if (pathaoError?.message) {
          errorMessage = pathaoError.message;
        }

        throw new PathaoApiError(
          errorMessage,
          "ORDER_CREATION_FAILED",
          { error: pathaoError },
          true
        );
      }
      throw error;
    }
  }

  // ============================================
  // RETRY FAILED DELIVERY
  // ============================================

  async retryDelivery(deliveryId: string): Promise<PathaoDelivery> {
    const delivery = await prisma.pathaoDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
                variant: true
              }
            }
          }
        }
      }
    });

    if (!delivery) {
      throw new ApiError(httpStatus.NOT_FOUND, "Delivery not found");
    }

    // Check if retry limit exceeded (max 3 retries)
    if (delivery.retryCount >= 3) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Maximum retry attempts exceeded. Please contact support."
      );
    }

    // Check if delivery is in a retriable state
    if (
      delivery.status === PathaoDeliveryStatus.CREATED ||
      delivery.status === PathaoDeliveryStatus.DELIVERED
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Delivery is already successful and cannot be retried"
      );
    }

    // Delete existing failed delivery
    await prisma.pathaoDelivery.delete({
      where: { id: deliveryId }
    });

    // Create new delivery
    return await this.createDelivery({ orderId: delivery.orderId });
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  async handleWebhook(payload: IPathaoWebhookPayload): Promise<void> {
    // Save webhook log first
    const webhookLog = await prisma.pathaoWebhookLog.create({
      data: {
        consignmentId: payload.consignment_id,
        merchantOrderId: payload.merchant_order_id,
        payload: JSON.parse(JSON.stringify(payload)),
        processed: false
      }
    });

    try {
      // Find delivery by consignment ID
      const delivery = await prisma.pathaoDelivery.findUnique({
        where: { consignmentId: payload.consignment_id }
      });

      if (!delivery) {
        await prisma.pathaoWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            processed: true,
            processedAt: new Date(),
            error:
              "Delivery not found for consignment ID: " + payload.consignment_id
          }
        });
        return;
      }

      // Map Pathao status to our status
      let newStatus: string = delivery.status;

      switch (payload.order_status.toUpperCase()) {
        case "PICKUP_REQUESTED":
        case "PENDING_PICKUP":
          newStatus = PathaoDeliveryStatus.PICKUP_REQUESTED;
          break;
        case "ASSIGNED_FOR_PICKUP":
        case "ASSIGNED FOR PICKUP":
          newStatus = PathaoDeliveryStatus.ASSIGNED_FOR_PICKUP;
          break;
        case "PICKED_UP":
        case "RECEIVED":
        case "PICKUP":
          newStatus = PathaoDeliveryStatus.PICKED_UP;
          break;
        case "PICKUP_FAILED":
        case "PICKUP FAILED":
          newStatus = PathaoDeliveryStatus.PICKUP_FAILED;
          break;
        case "PICKUP_CANCELLED":
        case "PICKUP CANCELLED":
          newStatus = PathaoDeliveryStatus.PICKUP_CANCELLED;
          break;
        case "AT_SORTING_HUB":
        case "AT THE SORTING HUB":
          newStatus = PathaoDeliveryStatus.AT_SORTING_HUB;
          break;
        case "IN_TRANSIT":
        case "ON_THE_WAY":
          newStatus = PathaoDeliveryStatus.IN_TRANSIT;
          break;
        case "RECEIVED_AT_LAST_MILE_HUB":
        case "RECEIVED AT LAST MILE HUB":
          newStatus = PathaoDeliveryStatus.RECEIVED_AT_LAST_MILE;
          break;
        case "ASSIGNED_FOR_DELIVERY":
        case "ASSIGNED FOR DELIVERY":
          newStatus = PathaoDeliveryStatus.ASSIGNED_FOR_DELIVERY;
          break;
        case "DELIVERED":
          newStatus = PathaoDeliveryStatus.DELIVERED;
          break;
        case "PARTIAL_DELIVERY":
        case "PARTIAL DELIVERY":
          newStatus = PathaoDeliveryStatus.PARTIAL_DELIVERY;
          break;
        case "RETURNED":
        case "RETURN":
          newStatus = PathaoDeliveryStatus.RETURNED;
          break;
        case "DELIVERY_FAILED":
        case "DELIVERY FAILED":
          newStatus = PathaoDeliveryStatus.DELIVERY_FAILED;
          break;
        case "ON_HOLD":
        case "ON HOLD":
          newStatus = PathaoDeliveryStatus.ON_HOLD;
          break;
        case "CANCELLED":
        case "CANCEL":
          newStatus = PathaoDeliveryStatus.CANCELLED;
          break;
        default:
          // Unknown status — just log, don't update
          break;
      }

      // Update delivery status
      await prisma.pathaoDelivery.update({
        where: { id: delivery.id },
        data: {
          status: newStatus
        }
      });

      // Create status history
      await prisma.pathaoDeliveryStatusHistory.create({
        data: {
          pathaoDeliveryId: delivery.id,
          status: newStatus,
          remarks: `Webhook received: ${payload.event_type}`,
          metadata: JSON.parse(JSON.stringify(payload))
        }
      });

      // Update order status based on delivery status
      if (newStatus === PathaoDeliveryStatus.PICKED_UP) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.SHIPPED }
        });
      } else if (
        newStatus === PathaoDeliveryStatus.IN_TRANSIT ||
        newStatus === PathaoDeliveryStatus.ASSIGNED_FOR_DELIVERY
      ) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.OUT_FOR_DELIVERY }
        });
      } else if (newStatus === PathaoDeliveryStatus.DELIVERED) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.DELIVERED }
        });
      } else if (
        newStatus === PathaoDeliveryStatus.RETURNED ||
        newStatus === PathaoDeliveryStatus.PARTIAL_DELIVERY
      ) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.RETURNED }
        });
      } else if (
        newStatus === PathaoDeliveryStatus.CANCELLED ||
        newStatus === PathaoDeliveryStatus.PICKUP_CANCELLED
      ) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.CANCELLED }
        });
      }

      // Mark webhook as processed
      await prisma.pathaoWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });
    } catch (error) {
      // Log error in webhook log
      await prisma.pathaoWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown error"
        }
      });
      throw error;
    }
  }

  // ============================================
  // CREDENTIALS MANAGEMENT
  // ============================================

  async saveCredentials(
    data: IPathaoCredentialsInput
  ): Promise<PathaoCredential> {
    // Check if credentials already exist for this branch
    const existing = await prisma.pathaoCredential.findUnique({
      where: { branchId: data.branchId }
    });

    let credentials: PathaoCredential;

    if (existing) {
      // Update existing credentials — only update password if provided
      credentials = await prisma.pathaoCredential.update({
        where: { branchId: data.branchId },
        data: {
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          username: data.username,
          ...(data.password && { password: data.password }),
          environment: data.environment,
          webhookSecret: data.webhookSecret ?? null,
          // Clear tokens on update so they re-authenticate fresh
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null
        }
      });
    } else {
      // Create new credentials — password is required for first-time setup
      if (!data.password) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Password is required when setting up Pathao credentials for the first time"
        );
      }
      credentials = await prisma.pathaoCredential.create({
        data: {
          branchId: data.branchId,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          username: data.username,
          password: data.password,
          environment: data.environment,
          webhookSecret: data.webhookSecret ?? null
        }
      });
    }

    // Clear cached token for this branch
    this.tokenCache.delete(data.branchId);

    return credentials;
  }

  private async getCredentialsByBranch(
    branchId: string
  ): Promise<PathaoCredential | null> {
    return prisma.pathaoCredential.findUnique({
      where: { branchId }
    });
  }

  // ============================================
  // ADMIN: Get All Deliveries
  // ============================================

  async getAllDeliveries(filters?: {
    status?: string;
    storeId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<PathaoDelivery[]> {
    const where: Prisma.PathaoDeliveryWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.storeId) {
      where.pathaoStoreId = filters.storeId;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate;
      }
    }

    return await prisma.pathaoDelivery.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            totalAmount: true,
            status: true
          }
        },
        pathaoStore: {
          select: {
            id: true,
            name: true,
            pathaoStoreId: true
          }
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  // ============================================
  // ADMIN: Get Delivery By ID
  // ============================================

  async getDeliveryById(deliveryId: string): Promise<PathaoDelivery | null> {
    return await prisma.pathaoDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: true,
        pathaoStore: true,
        city: true,
        zone: true,
        area: true,
        statusHistory: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  }

  // ============================================
  // ADMIN: Get Delivery Status from Pathao API
  // ============================================

  async fetchDeliveryStatus(
    branchId: string,
    consignmentId: string
  ): Promise<IPathaoOrderStatusResponse> {
    const baseUrl = await this.getBaseUrl(branchId);
    const headers = await this.getAuthHeaders(branchId);
    try {
      const response = await this.axiosInstance.get<IPathaoOrderStatusResponse>(
        `${baseUrl}/orders/${consignmentId}/info`,
        { headers }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new PathaoApiError(
          "Failed to fetch delivery status",
          "FETCH_STATUS_FAILED",
          { error: error.response?.data }
        );
      }
      throw error;
    }
  }

  // ============================================
  // SYNC DELIVERY STATUS FROM PATHAO API
  // ============================================

  async syncDeliveryStatus(orderId: string): Promise<PathaoDelivery> {
    // 1. Find the delivery for this order
    const delivery = await prisma.pathaoDelivery.findUnique({
      where: { orderId },
      include: { pathaoStore: { include: { branch: true } } }
    });

    if (!delivery) {
      throw new Error("No Pathao delivery found for this order");
    }

    if (!delivery.consignmentId) {
      throw new Error("Delivery has no consignment ID yet");
    }

    const branchId = delivery.pathaoStore.branchId;

    // 2. Fetch latest status from Pathao API
    const pathaoStatus = await this.fetchDeliveryStatus(
      branchId,
      delivery.consignmentId
    );

    const rawStatus = pathaoStatus.data.order_status?.toUpperCase() ?? "";

    // 3. Map Pathao status to our PathaoDelivery status
    const statusMap: Record<string, PathaoDeliveryStatus> = {
      PENDING: PathaoDeliveryStatus.PENDING,
      PICKUP_REQUESTED: PathaoDeliveryStatus.PICKUP_REQUESTED,
      PENDING_PICKUP: PathaoDeliveryStatus.PICKUP_REQUESTED,
      "ASSIGNED FOR PICKUP": PathaoDeliveryStatus.ASSIGNED_FOR_PICKUP,
      PICKUP: PathaoDeliveryStatus.PICKED_UP,
      PICKED_UP: PathaoDeliveryStatus.PICKED_UP,
      RECEIVED: PathaoDeliveryStatus.PICKED_UP,
      PICKUP_FAILED: PathaoDeliveryStatus.PICKUP_FAILED,
      PICKUP_CANCELLED: PathaoDeliveryStatus.PICKUP_CANCELLED,
      "AT THE SORTING HUB": PathaoDeliveryStatus.AT_SORTING_HUB,
      IN_TRANSIT: PathaoDeliveryStatus.IN_TRANSIT,
      ON_THE_WAY: PathaoDeliveryStatus.IN_TRANSIT,
      "RECEIVED AT LAST MILE HUB": PathaoDeliveryStatus.RECEIVED_AT_LAST_MILE,
      "ASSIGNED FOR DELIVERY": PathaoDeliveryStatus.ASSIGNED_FOR_DELIVERY,
      DELIVERED: PathaoDeliveryStatus.DELIVERED,
      "PARTIAL DELIVERY": PathaoDeliveryStatus.PARTIAL_DELIVERY,
      RETURN: PathaoDeliveryStatus.RETURNED,
      RETURNED: PathaoDeliveryStatus.RETURNED,
      "DELIVERY FAILED": PathaoDeliveryStatus.DELIVERY_FAILED,
      "ON HOLD": PathaoDeliveryStatus.ON_HOLD,
      CANCELLED: PathaoDeliveryStatus.CANCELLED,
      CANCEL: PathaoDeliveryStatus.CANCELLED
    };

    const newDeliveryStatus =
      statusMap[rawStatus] ?? PathaoDeliveryStatus.PENDING;

    // 4. Map to OrderStatus
    const orderStatusMap: Partial<Record<PathaoDeliveryStatus, OrderStatus>> = {
      [PathaoDeliveryStatus.PICKED_UP]: OrderStatus.SHIPPED,
      [PathaoDeliveryStatus.IN_TRANSIT]: OrderStatus.OUT_FOR_DELIVERY,
      [PathaoDeliveryStatus.ASSIGNED_FOR_DELIVERY]:
        OrderStatus.OUT_FOR_DELIVERY,
      [PathaoDeliveryStatus.DELIVERED]: OrderStatus.DELIVERED,
      [PathaoDeliveryStatus.RETURNED]: OrderStatus.RETURNED,
      [PathaoDeliveryStatus.PARTIAL_DELIVERY]: OrderStatus.RETURNED,
      [PathaoDeliveryStatus.CANCELLED]: OrderStatus.CANCELLED,
      [PathaoDeliveryStatus.PICKUP_CANCELLED]: OrderStatus.CANCELLED
    };

    const newOrderStatus = orderStatusMap[newDeliveryStatus] ?? null;

    // 5. Update PathaoDelivery status + create history + update Order status
    const updatedDelivery = await prisma.pathaoDelivery.update({
      where: { id: delivery.id },
      data: {
        status: newDeliveryStatus,
        statusHistory: {
          create: {
            status: newDeliveryStatus
          }
        }
      },
      include: {
        statusHistory: { orderBy: { createdAt: "desc" } }
      }
    });

    if (newOrderStatus) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus }
      });
    }

    return updatedDelivery;
  }

  // ============================================
  // ADMIN: Get All Stores
  // ============================================

  async getAllStores(): Promise<PathaoStore[]> {
    return await prisma.pathaoStore.findMany({
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            store: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        city: true,
        zone: true,
        area: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  // ============================================
  // CREATE DELIVERY FOR SPECIFIC ORDER
  // ============================================

  async createDeliveryForOrder(orderId: string): Promise<PathaoDelivery> {
    // Get order with all details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        },
        assignedBranch: {
          include: {
            pathaoStore: true
          }
        }
      }
    });

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    // Check if order status is READY_FOR_PICKUP
    if (order.status !== "READY_FOR_PICKUP") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Order must be in READY_FOR_PICKUP status. Current status: ${order.status}`
      );
    }

    // Check if delivery already exists
    const existingDelivery = await prisma.pathaoDelivery.findUnique({
      where: { orderId }
    });

    if (existingDelivery) {
      if (existingDelivery.status === "FAILED") {
        // Delete failed delivery record to allow fresh retry
        await prisma.pathaoDelivery.delete({
          where: { orderId }
        });
      } else {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Pathao delivery already exists for this order"
        );
      }
    }

    // Check if branch has Pathao store registered
    if (!order.assignedBranch?.pathaoStore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Branch does not have a Pathao store registered. Please register the store first."
      );
    }

    // Now call the existing createDelivery method with proper payload
    return await this.createDelivery({ orderId });
  }

  async getStoreByBranch(branchId: string): Promise<PathaoStore | null> {
    return await prisma.pathaoStore.findUnique({
      where: { branchId },
      include: {
        city: true,
        zone: true,
        area: true
      }
    });
  }
}

export default new PathaoService();
