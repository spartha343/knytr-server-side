import express from "express";
import { ProductMediaController } from "./productMedia.controller";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get product media (Public)
router.get("/product/:productId", ProductMediaController.getProductMedia);

// Upload product media (Vendor only - for their own products)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  ProductMediaController.uploadProductMedia
);

// Set primary media (Vendor only - for their own products)
router.patch(
  "/:id/set-primary",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  ProductMediaController.setPrimaryMedia
);

// Delete product media (Vendor only - for their own products)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  ProductMediaController.deleteProductMedia
);

export const ProductMediaRoutes = router;
