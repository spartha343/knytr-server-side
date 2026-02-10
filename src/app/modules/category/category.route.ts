import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { CategoryController } from "./category.controller";
import { CategoryValidation } from "./category.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all categories (Public - anyone can view)
router.get("/", CategoryController.getAllCategories);

// Get category by ID (Public)
router.get("/:id", CategoryController.getCategoryById);

// Get category children (Public)
router.get("/:id/children", CategoryController.getCategoryChildren);

// Create category (Admin/SuperAdmin only)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(CategoryValidation.create),
  CategoryController.createCategory
);

// Update category (Admin/SuperAdmin only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateRequest(CategoryValidation.update),
  CategoryController.updateCategory
);

// Delete category (Admin/SuperAdmin only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  CategoryController.deleteCategory
);

export const CategoryRoutes = router;
