import cloudinary from "../config/cloudinary.config";
import type { UploadApiResponse } from "cloudinary";

// Upload image buffer to Cloudinary
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string,
  fileName?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    // Build upload options dynamically to avoid undefined issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadOptions: any = {
      folder: `knytr/${folder}`,
      transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }]
    };

    // Only add public_id if fileName is provided
    if (fileName) {
      uploadOptions.public_id = fileName;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

// Delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error deleting image from Cloudinary:", error);
    // Don't throw error - just log it
  }
};

// Extract public_id from Cloudinary URL
export const extractPublicId = (url: string): string => {
  // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/knytr/stores/logos/image.jpg
  const parts = url.split("/");
  const uploadIndex = parts.findIndex((part) => part === "upload");

  if (uploadIndex === -1) return "";

  // Get everything after 'upload/v1234567890/'
  const pathParts = parts.slice(uploadIndex + 2);
  const publicIdWithExtension = pathParts.join("/");

  // Remove file extension
  const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");

  return publicId;
};

export const imageHelper = {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId
};
