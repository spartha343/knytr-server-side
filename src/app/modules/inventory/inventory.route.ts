import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { InventoryController } from "./inventory.controller";
import { InventoryValidation } from "./inventory.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get inventory by variant (Public)
router.get("/variant/:variantId", InventoryController.getInventoryByVariant);

// Get inventory by branch (Public)
router.get("/branch/:branchId", InventoryController.getInventoryByBranch);

// Get low stock items (Vendor - own products only)
router.get(
  "/low-stock",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  InventoryController.getLowStockItems
);

// Create inventory (Vendor)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(InventoryValidation.create),
  InventoryController.createInventory
);

// Bulk create inventory (Vendor)
router.post(
  "/bulk",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(InventoryValidation.bulkCreate),
  InventoryController.bulkCreateInventory
);

// Update inventory (Vendor - own products only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(InventoryValidation.update),
  InventoryController.updateInventory
);

// Adjust stock (add/subtract) (Vendor - own products only)
router.patch(
  "/:id/adjust",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(InventoryValidation.adjustStock),
  InventoryController.adjustStock
);

export const InventoryRoutes = router;
