import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ProductController } from "./product.controller";
import { ProductValidation } from "./product.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all products (Public)
router.get("/", ProductController.getAllProducts);

// Get product by ID (Public)
router.get("/:id", ProductController.getProductById);

// Create product (Vendor only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductValidation.create),
  ProductController.createProduct
);

// Update product (Vendor - own products only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductValidation.update),
  ProductController.updateProduct
);

// Delete product (Vendor - own products only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  ProductController.deleteProduct
);

export const ProductRoutes = router;
