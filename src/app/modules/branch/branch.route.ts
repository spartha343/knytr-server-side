import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { BranchController } from "./branch.controller";
import { BranchValidation } from "./branch.validation";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// Get all branches (Admin only)
router.get(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  BranchController.getAllBranches
);

// Get branches by store ID (Vendor/Admin)
router.get(
  "/store/:storeId",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  BranchController.getBranchesByStore
);

// Get branch by ID
router.get(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  BranchController.getBranchById
);

// Create branch (Vendor only - for their stores)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(BranchValidation.create),
  BranchController.createBranch
);

// Update branch (Vendor - own store's branch only)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(BranchValidation.update),
  BranchController.updateBranch
);

// Delete branch (Vendor - own store's branch only)
router.delete(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR", "ADMIN", "SUPER_ADMIN"),
  BranchController.deleteBranch
);

export const BranchRoutes = router;
