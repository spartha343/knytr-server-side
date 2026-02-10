import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { BrandController } from "./brand.controller";
import { BrandValidation } from "./brand.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all brands (Public - anyone can view)
router.get("/", BrandController.getAllBrands);

// Get brand by ID (Public)
router.get("/:id", BrandController.getBrandById);

// Create brand (Admin/SuperAdmin only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(BrandValidation.create),
  BrandController.createBrand
);

// Update brand (Admin/SuperAdmin only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(BrandValidation.update),
  BrandController.updateBrand
);

// Delete brand (Admin/SuperAdmin only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  BrandController.deleteBrand
);

export const BrandRoutes = router;
