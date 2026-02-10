import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ProductVariantController } from "./productVariant.controller";
import { ProductVariantValidation } from "./productVariant.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all variants for a product (Public)
router.get("/product/:productId", ProductVariantController.getProductVariants);

// Get variant by ID (Public)
router.get("/:id", ProductVariantController.getVariantById);

// Create single variant (Vendor)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductVariantValidation.create),
  ProductVariantController.createProductVariant
);

// Bulk create variants (Vendor)
router.post(
  "/bulk",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductVariantValidation.bulkCreate),
  ProductVariantController.bulkCreateProductVariants
);

// Update variant (Vendor - own products only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductVariantValidation.update),
  ProductVariantController.updateProductVariant
);

// Delete variant (Vendor - own products only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  ProductVariantController.deleteProductVariant
);

export const ProductVariantRoutes = router;
