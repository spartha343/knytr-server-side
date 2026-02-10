import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import { imageHelper } from "../../../helpers/imageHelper";
import type { ProductMedia } from "../../../generated/prisma/client";
import type { IUploadProductMediaRequest } from "./productMedia.interface";

const uploadProductMedia = async (
  userId: string,
  payload: IUploadProductMediaRequest
): Promise<ProductMedia[]> => {
  const { productId, urls } = payload;

  // Verify product exists and user owns it
  const product = await prisma.product.findUnique({
    where: { id: productId, isDeleted: false },
    include: {
      store: true
    }
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // Check ownership
  if (product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only add media to your own products"
    );
  }

  // Get existing media count for ordering
  const existingMediaCount = await prisma.productMedia.count({
    where: { productId }
  });

  // Check if product has any existing media
  const hasExistingMedia = existingMediaCount > 0;

  // Create ProductMedia records
  const mediaRecords = urls.map((url, index) => ({
    productId,
    mediaType: "IMAGE",
    mediaUrl: url,
    isPrimary: !hasExistingMedia && index === 0, // First image is primary only if no existing media
    order: existingMediaCount + index
  }));

  await prisma.productMedia.createMany({
    data: mediaRecords
  });

  // Fetch and return created media
  const result = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: { order: "asc" }
  });

  return result;
};

const setPrimaryMedia = async (
  mediaId: string,
  userId: string
): Promise<ProductMedia> => {
  // Find the media and verify ownership
  const media = await prisma.productMedia.findUnique({
    where: { id: mediaId },
    include: {
      product: {
        include: {
          store: true
        }
      }
    }
  });

  if (!media) {
    throw new ApiError(httpStatus.NOT_FOUND, "Media not found");
  }

  // Check ownership
  if (media.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only modify media for your own products"
    );
  }

  // Use transaction to ensure consistency
  const result = await prisma.$transaction(async (tx) => {
    // Set all media of this product to non-primary
    await tx.productMedia.updateMany({
      where: { productId: media.productId },
      data: { isPrimary: false }
    });

    // Set this media as primary
    const updatedMedia = await tx.productMedia.update({
      where: { id: mediaId },
      data: { isPrimary: true }
    });

    return updatedMedia;
  });

  return result;
};

const deleteProductMedia = async (
  mediaId: string,
  userId: string
): Promise<ProductMedia> => {
  // Find the media and verify ownership
  const media = await prisma.productMedia.findUnique({
    where: { id: mediaId },
    include: {
      product: {
        include: {
          store: true
        }
      }
    }
  });

  if (!media) {
    throw new ApiError(httpStatus.NOT_FOUND, "Media not found");
  }

  // Check ownership
  if (media.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only delete media from your own products"
    );
  }

  // Delete from Cloudinary
  try {
    const publicId = imageHelper.extractPublicId(media.mediaUrl);
    await imageHelper.deleteFromCloudinary(publicId);
  } catch (error) {
    // Log error but don't fail the operation
    // eslint-disable-next-line no-console
    console.error("Failed to delete from Cloudinary:", error);
  }

  // Delete from database
  const deletedMedia = await prisma.productMedia.delete({
    where: { id: mediaId }
  });

  // If deleted media was primary, set another image as primary
  if (deletedMedia.isPrimary) {
    const remainingMedia = await prisma.productMedia.findFirst({
      where: { productId: media.productId },
      orderBy: { order: "asc" }
    });

    if (remainingMedia) {
      await prisma.productMedia.update({
        where: { id: remainingMedia.id },
        data: { isPrimary: true }
      });
    }
  }

  return deletedMedia;
};

const getProductMedia = async (productId: string): Promise<ProductMedia[]> => {
  const media = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: { order: "asc" }
  });

  return media;
};

export const ProductMediaService = {
  uploadProductMedia,
  setPrimaryMedia,
  deleteProductMedia,
  getProductMedia
};
