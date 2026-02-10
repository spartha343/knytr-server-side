import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { AttributeController } from "./attribute.controller";
import { AttributeValidation } from "./attribute.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// ==================== ATTRIBUTE ROUTES ====================

// Get all attributes (Public - vendors need to see available attributes)
router.get("/", AttributeController.getAllAttributes);

// Get attribute by ID (Public)
router.get("/:id", AttributeController.getAttributeById);

// Create attribute (Admin/SuperAdmin only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(AttributeValidation.createAttribute),
  AttributeController.createAttribute
);

// Update attribute (Admin/SuperAdmin only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(AttributeValidation.updateAttribute),
  AttributeController.updateAttribute
);

// Delete attribute (Admin/SuperAdmin only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  AttributeController.deleteAttribute
);

// ==================== ATTRIBUTE VALUE ROUTES ====================

// Get all values for an attribute (Public)
router.get("/:attributeId/values", AttributeController.getAllAttributeValues);

// Get attribute value by ID (Public)
router.get("/values/:id", AttributeController.getAttributeValueById);

// Create attribute value (Admin/SuperAdmin only)
router.post(
  "/values",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(AttributeValidation.createAttributeValue),
  AttributeController.createAttributeValue
);

// Update attribute value (Admin/SuperAdmin only)
router.patch(
  "/values/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(AttributeValidation.updateAttributeValue),
  AttributeController.updateAttributeValue
);

// Delete attribute value (Admin/SuperAdmin only)
router.delete(
  "/values/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  AttributeController.deleteAttributeValue
);

export const AttributeRoutes = router;
