import express from "express";
import { PathaoController } from "./pathao.controller";
import { PathaoValidation } from "./pathao.validation";
import validateRequest from "../../middlewares/validateRequest";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";
import { RoleType } from "../../../generated/prisma/enums";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication needed)
// ============================================

// Get all cities
router.get("/cities", PathaoController.getCities);

// Get zones by city
router.get("/zones/:cityId", PathaoController.getZones);

// Get areas by zone
router.get("/areas/:zoneId", PathaoController.getAreas);

// Webhook endpoint (public but verified by signature)
router.post("/webhook", PathaoController.handleWebhook);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Save credentials (Vendor only - for their branch)
router.post(
  "/credentials",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.VENDOR),
  validateRequest(PathaoValidation.saveCredentials),
  PathaoController.saveCredentials
);

// Get credentials by branch (Vendor only)
router.get(
  "/credentials/:branchId",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.VENDOR),
  PathaoController.getCredentialsByBranch
);

// Register store with Pathao (Vendor/Admin only)
router.post(
  "/stores/register",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(PathaoValidation.registerStore),
  PathaoController.registerStore
);

// Sync locations from Pathao API (Admin only - this is a heavy operation)
// Query params: fullSync=true, maxZones=10, delayBetweenCities=3000, delayBetweenZones=3000
router.post(
  "/sync-locations",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  PathaoController.syncLocations
);

// Batch sync areas (Admin only - process zones in batches)
// Query params: batchSize=50, startFromZoneId=0, delayBetweenZones=3000
router.post(
  "/sync-areas-batch",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  PathaoController.syncAreasBatch
);

// Get sync progress (Admin only)
router.get(
  "/sync-progress",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  PathaoController.getSyncProgress
);

// ============================================
// ADMIN/VENDOR MANAGEMENT ROUTES
// ============================================

// Get all deliveries (Admin/Vendor)
router.get(
  "/deliveries",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.getAllDeliveries
);

// Get delivery by ID (Admin/Vendor)
router.get(
  "/deliveries/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.getDeliveryById
);

// Fetch delivery status from Pathao API (Admin/Vendor)
router.get(
  "/branches/:branchId/delivery-status/:consignmentId",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.VENDOR, RoleType.ADMIN),
  PathaoController.fetchDeliveryStatus
);

// Get store by branch (Vendor only)
router.get(
  "/stores/branch/:branchId",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.getStoreByBranch
);

// Get all stores (Admin/Vendor)
router.get(
  "/stores",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.getAllStores
);

// Retry failed delivery (Admin/Vendor)
router.post(
  "/deliveries/:id/retry",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.retryDelivery
);

// Create delivery for specific order (Vendor/Admin - manual trigger)
router.post(
  "/orders/:orderId/create-delivery",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(PathaoValidation.createDeliveryWithLocation),
  PathaoController.createDeliveryForOrder
);

// Sync delivery status from Pathao API (Vendor/Admin - manual trigger)
router.post(
  "/orders/:orderId/sync-status",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  PathaoController.syncDeliveryStatus
);

export const PathaoRoutes = router;
