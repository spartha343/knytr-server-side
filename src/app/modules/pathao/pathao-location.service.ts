/* eslint-disable no-console */
import axios, { type AxiosInstance } from "axios";
import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  IPathaoCityResponse,
  IPathaoZoneResponse,
  IPathaoAreaResponse
} from "./pathao.interface";
import { pathaoErrorMessages } from "./pathao.constants";

class PathaoLocationService {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

  private async getBaseUrl(): Promise<string> {
    const credentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });

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

  private async authenticate(): Promise<string> {
    const credentials = await prisma.pathaoCredential.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });

    if (!credentials) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        pathaoErrorMessages.CREDENTIALS_NOT_FOUND
      );
    }

    const baseUrl = await this.getBaseUrl();

    try {
      const response = await this.axiosInstance.post(
        `${baseUrl.replace("/aladdin/api/v1", "")}/aladdin/api/v1/issue-token`,
        {
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          username: credentials.username,
          password: credentials.password,
          grant_type: "password"
        }
      );

      const token = response.data.access_token;
      this.accessToken = token;
      return token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          `Pathao authentication failed: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  // ============================================
  // SYNC CITIES
  // ============================================

  async syncCities(): Promise<{ synced: number; message: string }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getAuthHeaders();

    try {
      const response = await this.axiosInstance.get<IPathaoCityResponse>(
        `${baseUrl}/city-list`,
        { headers }
      );

      const cities = response.data.data.data;
      let syncedCount = 0;

      for (const city of cities) {
        await prisma.pathaoCity.upsert({
          where: { cityId: city.city_id },
          update: {
            name: city.city_name,
            isActive: true
          },
          create: {
            cityId: city.city_id,
            name: city.city_name,
            isActive: true
          }
        });
        syncedCount++;
      }

      return {
        synced: syncedCount,
        message: `Successfully synced ${syncedCount} cities from Pathao`
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Failed to sync cities: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  // ============================================
  // SYNC ZONES FOR A CITY
  // ============================================

  async syncZonesForCity(
    cityId: number
  ): Promise<{ synced: number; message: string }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getAuthHeaders();

    try {
      // Add delay before API call
      await this.delay(1500);

      const response = await this.axiosInstance.get<IPathaoZoneResponse>(
        `${baseUrl}/cities/${cityId}/zone-list`,
        { headers }
      );

      const zones = response.data.data.data;
      let syncedCount = 0;

      for (const zone of zones) {
        await prisma.pathaoZone.upsert({
          where: { zoneId: zone.zone_id },
          update: {
            name: zone.zone_name,
            cityId: cityId,
            isActive: true
          },
          create: {
            zoneId: zone.zone_id,
            name: zone.zone_name,
            cityId: cityId,
            isActive: true
          }
        });
        syncedCount++;
      }

      return {
        synced: syncedCount,
        message: `Successfully synced ${syncedCount} zones for city ${cityId}`
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Failed to sync zones: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  // ============================================
  // SYNC AREAS FOR A ZONE
  // ============================================

  async syncAreasForZone(
    zoneId: number
  ): Promise<{ synced: number; message: string }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getAuthHeaders();

    try {
      // Add delay before API call
      await this.delay(2000);

      const response = await this.axiosInstance.get<IPathaoAreaResponse>(
        `${baseUrl}/zones/${zoneId}/area-list`,
        { headers }
      );

      const areas = response.data.data.data;
      let syncedCount = 0;

      for (const area of areas) {
        await prisma.pathaoArea.upsert({
          where: { areaId: area.area_id },
          update: {
            name: area.area_name,
            zoneId: zoneId,
            homeDeliveryAvailable: area.home_delivery_available,
            pickupAvailable: area.pickup_available,
            isActive: true
          },
          create: {
            areaId: area.area_id,
            name: area.area_name,
            zoneId: zoneId,
            homeDeliveryAvailable: area.home_delivery_available,
            pickupAvailable: area.pickup_available,
            isActive: true
          }
        });
        syncedCount++;
      }

      return {
        synced: syncedCount,
        message: `Successfully synced ${syncedCount} areas for zone ${zoneId}`
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Failed to sync areas: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  // ============================================
  // SYNC ALL LOCATIONS (FULL SYNC)
  // ============================================

  async syncAllLocations(options?: {
    fullSync?: boolean;
    maxZones?: number;
    delayBetweenCities?: number;
    delayBetweenZones?: number;
  }): Promise<{
    cities: number;
    zones: number;
    areas: number;
    message: string;
  }> {
    const {
      fullSync = false,
      maxZones = 3,
      delayBetweenCities = 3000,
      delayBetweenZones = 3000
    } = options || {};

    let citiesCount = 0;
    let zonesCount = 0;
    let areasCount = 0;
    let failedZones = 0;

    try {
      // Step 1: Sync cities
      console.log("🌆 Starting cities sync...");
      const citiesResult = await this.syncCities();
      citiesCount = citiesResult.synced;
      console.log(`✅ Synced ${citiesCount} cities`);

      // Wait 1 second before next batch
      await this.delay(1000);

      // Step 2: Get all synced cities
      const cities = await prisma.pathaoCity.findMany({
        where: { isActive: true }
      });

      // Step 3: Sync zones for each city (with delays)
      console.log(`Starting zones sync for ${cities.length} cities...`);
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        if (!city) continue;

        console.log(
          `  Syncing zones for city ${i + 1}/${cities.length}: ${city.name}`
        );
        const zonesResult = await this.syncZonesForCity(city.cityId);
        zonesCount += zonesResult.synced;

        // Wait between cities to avoid rate limiting
        if (i < cities.length - 1) {
          await this.delay(delayBetweenCities);
        }
      }
      console.log(` Synced ${zonesCount} zones across all cities`);

      // Step 4: Get all synced zones
      const zones = await prisma.pathaoZone.findMany({
        where: { isActive: true },
        orderBy: { zoneId: "asc" }
      });

      // Step 5: Sync areas for each zone (with delays)
      const zonesToSync = fullSync ? zones : zones.slice(0, maxZones);
      console.log(
        `📍 Starting areas sync for ${zonesToSync.length} zones (Total zones: ${zones.length})...`
      );

      for (let i = 0; i < zonesToSync.length; i++) {
        const zone = zonesToSync[i];
        if (!zone) continue;

        try {
          console.log(
            `  Syncing areas for zone ${i + 1}/${zonesToSync.length}: ${zone.name} (ID: ${zone.zoneId})`
          );
          const areasResult = await this.syncAreasForZone(zone.zoneId);
          areasCount += areasResult.synced;

          // Add delay between zones (EXCEPT after the last zone)
          if (i < zonesToSync.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, delayBetweenZones)
            );
          }
        } catch (error) {
          failedZones++;
          console.error(
            ` Failed to sync zone ${zone.name}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      const syncType = fullSync ? "Full" : "Partial";
      const message = fullSync
        ? `${syncType} sync complete: ${citiesCount} cities, ${zonesCount} zones, ${areasCount} areas${failedZones > 0 ? ` (${failedZones} zones failed)` : ""}`
        : `${syncType} sync complete: ${citiesCount} cities, ${zonesCount} zones, ${areasCount} areas (synced ${zonesToSync.length}/${zones.length} zones)${failedZones > 0 ? ` (${failedZones} zones failed)` : ""}`;

      console.log(` ${message}`);

      return {
        cities: citiesCount,
        zones: zonesCount,
        areas: areasCount,
        message
      };
    } catch (error) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Location sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ============================================
  // BATCH SYNC AREAS (Process zones in batches)
  // ============================================

  async syncAreasBatch(options?: {
    batchSize?: number;
    startFromZoneId?: number;
    delayBetweenZones?: number;
  }): Promise<{
    processedZones: number;
    totalAreas: number;
    failedZones: number;
    lastProcessedZoneId: number | null;
    message: string;
  }> {
    const {
      batchSize = 50,
      startFromZoneId = 0,
      delayBetweenZones = 3000
    } = options || {};

    let processedZones = 0;
    let totalAreas = 0;
    let failedZones = 0;
    let lastProcessedZoneId: number | null = null;

    try {
      // Get zones to sync
      const zones = await prisma.pathaoZone.findMany({
        where: {
          isActive: true,
          zoneId: { gt: startFromZoneId }
        },
        orderBy: { zoneId: "asc" },
        take: batchSize
      });

      console.log(
        `📦 Processing batch of ${zones.length} zones starting from zone ID ${startFromZoneId}...`
      );
      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        if (!zone) continue;

        try {
          console.log(
            `  Processing zone ${i + 1}/${zones.length}: ${zone.name} (ID: ${zone.zoneId})`
          );

          const areasResult = await this.syncAreasForZone(zone.zoneId);
          totalAreas += areasResult.synced;
          processedZones++;
          lastProcessedZoneId = zone.zoneId;

          // Add delay between zones (EXCEPT after the last zone)
          if (i < zones.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, delayBetweenZones)
            );
          }
        } catch (error) {
          failedZones++;
          lastProcessedZoneId = zone.zoneId;
          console.error(
            `   Failed to sync zone ${zone.name}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      // Check if there are more zones to process
      const remainingZones = await prisma.pathaoZone.count({
        where: {
          isActive: true,
          zoneId: { gt: lastProcessedZoneId || startFromZoneId }
        }
      });

      const message = `Batch complete: Processed ${processedZones} zones, synced ${totalAreas} areas${failedZones > 0 ? `, ${failedZones} zones failed` : ""}${remainingZones > 0 ? `. ${remainingZones} zones remaining` : ". All zones processed!"}`;

      console.log(` ${message}`);

      return {
        processedZones,
        totalAreas,
        failedZones,
        lastProcessedZoneId,
        message
      };
    } catch (error) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Batch sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ============================================
  // GET SYNC PROGRESS
  // ============================================

  async getSyncProgress(): Promise<{
    totalCities: number;
    totalZones: number;
    totalAreas: number;
    zonesWithoutAreas: number;
    syncPercentage: number;
    message: string;
  }> {
    const [totalCities, totalZones, totalAreas, zonesWithoutAreas] =
      await Promise.all([
        prisma.pathaoCity.count({ where: { isActive: true } }),
        prisma.pathaoZone.count({ where: { isActive: true } }),
        prisma.pathaoArea.count({ where: { isActive: true } }),
        prisma.pathaoZone.count({
          where: {
            isActive: true,
            areas: { none: {} }
          }
        })
      ]);

    const syncPercentage =
      totalZones > 0
        ? Math.round(((totalZones - zonesWithoutAreas) / totalZones) * 100)
        : 0;

    return {
      totalCities,
      totalZones,
      totalAreas,
      zonesWithoutAreas,
      syncPercentage,
      message: `Sync progress: ${syncPercentage}% complete (${totalZones - zonesWithoutAreas}/${totalZones} zones synced)`
    };
  }

  // ============================================
  // LOCATION LOOKUP HELPERS
  // ============================================

  async getCityByName(cityName: string) {
    return await prisma.pathaoCity.findFirst({
      where: {
        name: {
          contains: cityName,
          mode: "insensitive"
        },
        isActive: true
      }
    });
  }

  async getZonesByCity(cityId: number) {
    return await prisma.pathaoZone.findMany({
      where: {
        cityId,
        isActive: true
      },
      orderBy: { name: "asc" }
    });
  }

  async getAreasByZone(zoneId: number) {
    return await prisma.pathaoArea.findMany({
      where: {
        zoneId,
        isActive: true
      },
      orderBy: { name: "asc" }
    });
  }

  async searchAreas(searchTerm: string) {
    return await prisma.pathaoArea.findMany({
      where: {
        name: {
          contains: searchTerm,
          mode: "insensitive"
        },
        isActive: true
      },
      include: {
        zone: {
          include: {
            city: true
          }
        }
      },
      take: 20
    });
  }
}

export default new PathaoLocationService();
