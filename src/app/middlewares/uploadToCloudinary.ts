import multer from "multer";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

// Multer memory storage (we'll upload to Cloudinary manually for more control)
const storage = multer.memoryStorage();

// File filter - only allow images
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fileFilter = (req: any, file: any, cb: any) => {
  // Allowed file types
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid file type. Only JPEG, JPG, PNG and WebP are allowed"
      ),
      false
    );
  }
};

// Single file upload
export const uploadSingle = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
}).single("file");

// Multiple files upload (max 5 files)
export const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max per file
  }
}).array("files", 5);
