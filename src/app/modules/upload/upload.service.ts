import { imageHelper } from "../../../helpers/imageHelper";
import type { IUploadResponse } from "./upload.interface";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";

const uploadSingleImage = async (
  file: Express.Multer.File | undefined,
  folder: string
): Promise<IUploadResponse> => {
  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No file provided");
  }

  try {
    const result = await imageHelper.uploadToCloudinary(file.buffer, folder);

    return {
      success: true,
      message: "Image uploaded successfully",
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Upload error:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to upload image"
    );
  }
};

const uploadMultipleImages = async (
  files: Express.Multer.File[] | undefined,
  folder: string
): Promise<IUploadResponse> => {
  if (!files || files.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No files provided");
  }

  try {
    const uploadPromises = files.map((file) =>
      imageHelper.uploadToCloudinary(file.buffer, folder)
    );

    const results = await Promise.all(uploadPromises);

    return {
      success: true,
      message: `${results.length} images uploaded successfully`,
      urls: results.map((r) => r.secure_url),
      publicIds: results.map((r) => r.public_id)
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Upload error:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to upload images"
    );
  }
};

const deleteImage = async (url: string): Promise<IUploadResponse> => {
  if (!url) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No image URL provided");
  }

  try {
    const publicId = imageHelper.extractPublicId(url);
    await imageHelper.deleteFromCloudinary(publicId);

    return {
      success: true,
      message: "Image deleted successfully"
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Delete error:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to delete image"
    );
  }
};

export const UploadService = {
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage
};
