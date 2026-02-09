import express from "express";
import { UploadController } from "./upload.controller";
import {
  uploadSingle,
  uploadMultiple
} from "../../middlewares/uploadToCloudinary";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";

const router = express.Router();

// Upload single image (protected - user must be authenticated)
router.post(
  "/single",
  verifyFirebaseAuth,
  uploadSingle,
  UploadController.uploadSingle
);

// Upload multiple images (protected)
router.post(
  "/multiple",
  verifyFirebaseAuth,
  uploadMultiple,
  UploadController.uploadMultiple
);

// Delete image (protected)
router.post("/delete", verifyFirebaseAuth, UploadController.deleteImage);

export const UploadRoutes = router;
