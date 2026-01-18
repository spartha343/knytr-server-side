import type { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../../errors/ApiError";
import { RoleService } from "./role.service";

const getRequestableRolesAndPreviousRequests = catchAsync(
  async (req: Request, res: Response) => {
    const dbUser = req.dbUser;
    if (!dbUser) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }
    const result =
      await RoleService.getRequestableRolesAndPreviousRequests(dbUser);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Requestable roles fetched successfully!",
      data: result
    });
  }
);

const requestRole = catchAsync(async (req: Request, res: Response) => {
  const dbUser = req.dbUser;
  const { roleId } = req.body;

  if (!dbUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }

  if (!roleId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "roleId is required");
  }

  const result = await RoleService.requestRole(dbUser, roleId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Role request submitted successfully !",
    data: result
  });
});

export const RoleController = {
  getRequestableRolesAndPreviousRequests,
  requestRole
};
