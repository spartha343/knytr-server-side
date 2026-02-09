import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { UploadService } from "./upload.service";
import type { Request, Response } from "express";

const uploadSingle = catchAsync(async (req: Request, res: Response) => {
  const folder = req.body.folder || "temp";
  const result = await UploadService.uploadSingleImage(req.file, folder);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Image uploaded successfully",
    data: result
  });
});

const uploadMultiple = catchAsync(async (req: Request, res: Response) => {
  const folder = req.body.folder || "temp";
  const files = req.files as Express.Multer.File[];
  const result = await UploadService.uploadMultipleImages(files, folder);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Images uploaded successfully",
    data: result
  });
});

const deleteImage = catchAsync(async (req: Request, res: Response) => {
  const { url } = req.body;
  const result = await UploadService.deleteImage(url);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Image deleted successfully",
    data: result
  });
});

export const UploadController = {
  uploadSingle,
  uploadMultiple,
  deleteImage
};
