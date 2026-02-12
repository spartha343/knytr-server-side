import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { StoreController } from "./store.controller";
import { StoreValidation } from "./store.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser"; // Add this import
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// ===== SPECIFIC ROUTES FIRST (before dynamic :idOrSlug) =====

// ADMIN ONLY: Get all stores including inactive (protected route)
router.get(
  "/admin/all",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  StoreController.getAllStores
);

// Get my stores (Vendor only)
router.get(
  "/my-stores",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  StoreController.getMyStores
);

// ===== PUBLIC ROUTES (No authentication) =====

// Get all active stores (public browsing)
router.get("/", StoreController.getPublicStores);

// Get store by ID or slug (public)
router.get("/:idOrSlug", StoreController.getPublicStoreByIdOrSlug);

// ===== MUTATION ROUTES =====

// Create store (Vendor only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(StoreValidation.create),
  StoreController.createStore
);

// Update store (Vendor - own store only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(StoreValidation.update),
  StoreController.updateStore
);

// Delete store (Vendor - own store only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  StoreController.deleteStore
);

export const StoreRoutes = router;
