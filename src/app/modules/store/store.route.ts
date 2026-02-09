import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { StoreController } from "./store.controller";
import { StoreValidation } from "./store.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser"; // Add this import
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all stores (Admin only)
router.get(
  "/",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  requireRole("ADMIN", "SUPER_ADMIN"),
  StoreController.getAllStores
);

// Get my stores (Vendor only)
router.get(
  "/my-stores",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  StoreController.getMyStores
);

// Get store by ID
router.get(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  StoreController.getStoreById
);

// Create store (Vendor only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(StoreValidation.create),
  StoreController.createStore
);

// Update store (Vendor - own store only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(StoreValidation.update),
  StoreController.updateStore
);

// Delete store (Vendor - own store only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser, // Add this
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  StoreController.deleteStore
);

export const StoreRoutes = router;
