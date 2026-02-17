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
  private accessToken: string | null = null;
  private tokenExpiryTime: number | null = null;
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
    const credentials = await this.getCredentialsByBranch(branchId);
    if (!credentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    // Check if we have a valid token in database
    if (credentials.accessToken && credentials.tokenExpiry) {
      const now = new Date();
      const expiryBuffer = new Date(
        credentials.tokenExpiry.getTime() - 5 * 60 * 1000
      ); // 5 min buffer

      if (now < expiryBuffer) {
        // Token is still valid
        this.accessToken = credentials.accessToken;
        this.tokenExpiryTime = credentials.tokenExpiry.getTime();
        return this.accessToken;
      }

      // Token expired, try refresh token first
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
      this.accessToken = access_token;
      this.tokenExpiryTime = tokenExpiry.getTime();

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
      this.accessToken = access_token;
      this.tokenExpiryTime = tokenExpiry.getTime();

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
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Store already registered with Pathao"
      );
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

    const payload: IPathaoStoreCreateRequest = {
      name: String(storeData.name),
      contact_name: String(storeData.contactName),
      contact_number: String(storeData.contactNumber),
      secondary_contact: storeData.secondaryContact,
      otp_number: storeData.otpNumber,
      address: branch.address.addressLine1,
      city_id: storeData.cityId,
      zone_id: storeData.zoneId,
      area_id: storeData.areaId
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
        store: {
          include: {
            branches: {
              include: {
                pathaoStore: true
              }
            }
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
    const orderBranch = order.store.branches.find((b) => b.pathaoStore);
    if (!orderBranch || !orderBranch.pathaoStore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.STORE_NOT_REGISTERED
      );
    }

    const pathaoStore = orderBranch.pathaoStore;
    const branchId = orderBranch.id;

    // Calculate total weight
    let totalWeight = 0;
    order.items.forEach((item) => {
      const weight = item.product?.weight || 0.5; // Default 0.5kg if not set
      totalWeight += Number(weight) * item.quantity;
    });

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
        store: {
          include: {
            branches: {
              include: {
                pathaoStore: true
              }
            }
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

    // Get branch with Pathao store
    const orderBranch = order.store.branches.find((b) => b.pathaoStore);
    if (!orderBranch || !orderBranch.pathaoStore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.STORE_NOT_REGISTERED
      );
    }

    const pathaoStore = orderBranch.pathaoStore;
    const branchId = orderBranch.id;

    // Calculate total weight
    let totalWeight = 0;
    let itemDescription = "";
    order.items.forEach((item, index) => {
      const weight = item.product?.weight || 0.5;
      totalWeight += Number(weight) * item.quantity;
      if (index > 0) itemDescription += ", ";
      itemDescription += `${item.product?.name || "Product"} x${item.quantity}`;
    });

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
        amountToCollect: Number(order.totalAmount),
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
      recipient_address: order.deliveryAddress,
      delivery_type: PathaoDeliveryType.NORMAL,
      item_type: PathaoItemType.PARCEL,
      item_quantity: order.items.length,
      item_weight: totalWeight,
      item_description: itemDescription,
      amount_to_collect: Number(order.totalAmount),
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
        throw new PathaoApiError(
          pathaoErrorMessages.ORDER_CREATION_FAILED,
          "ORDER_CREATION_FAILED",
          { error: error.response?.data }
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

    if (delivery.retryCount >= 3) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Maximum retry attempts reached"
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
        case "PICKED_UP":
        case "RECEIVED":
          newStatus = PathaoDeliveryStatus.PICKED_UP;
          break;
        case "IN_TRANSIT":
        case "ON_THE_WAY":
          newStatus = PathaoDeliveryStatus.IN_TRANSIT;
          break;
        case "DELIVERED":
          newStatus = PathaoDeliveryStatus.DELIVERED;
          break;
        case "RETURNED":
        case "RETURN":
          newStatus = PathaoDeliveryStatus.RETURNED;
          break;
        case "CANCELLED":
        case "CANCEL":
          newStatus = PathaoDeliveryStatus.CANCELLED;
          break;
        default:
          // Unknown status, just log it
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
      if (newStatus === PathaoDeliveryStatus.DELIVERED) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "DELIVERED" }
        });
      } else if (newStatus === PathaoDeliveryStatus.IN_TRANSIT) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "OUT_FOR_DELIVERY" }
        });
      } else if (newStatus === PathaoDeliveryStatus.RETURNED) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "RETURNED" }
        });
      } else if (newStatus === PathaoDeliveryStatus.CANCELLED) {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "CANCELLED" }
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
      // Update existing credentials
      credentials = await prisma.pathaoCredential.update({
        where: { branchId: data.branchId },
        data: {
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          username: data.username,
          password: data.password,
          environment: data.environment,
          webhookSecret: data.webhookSecret ?? null,
          // Clear tokens on update
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null
        }
      });
    } else {
      // Create new credentials
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
    this.accessToken = null;
    this.tokenExpiryTime = null;

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
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Pathao delivery already exists for this order"
      );
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
}

export default new PathaoService();
