import type { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import { AuthService } from "./auth.service";
import ApiError from "../../../errors/ApiError";

const SyncUserWithRole = catchAsync(async (req: Request, res: Response) => {
  const decodedUser = req.firebaseUser;

  if (!decodedUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }

  const result = await AuthService.SyncUserWithRole({
    email: decodedUser.email ? decodedUser.email : "",
    uid: decodedUser?.uid
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User created successfully !",
    data: result
  });
});

export const AuthController = {
  SyncUserWithRole
};
