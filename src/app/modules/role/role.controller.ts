import type { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../../errors/ApiError";
import { RoleService } from "./role.service";
import { roleFilterableFields } from "./role.constants";
import { paginationFields } from "../../../constants/pagination";
import pick from "../../../shared/pick";

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

const getAllRoleRequests = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, roleFilterableFields);
  const options = pick(req.query, paginationFields);

  const result = await RoleService.getAllRoleRequests(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Role requests fetched successfully",
    meta: result.meta,
    data: result.data
  });
});

const updateRoleRequestStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status");
  }
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "id not found!");
  }

  const result = await RoleService.updateRoleRequestStatus(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Role request updated successfully",
    data: result
  });
});

export const RoleController = {
  getRequestableRolesAndPreviousRequests,
  requestRole,
  getAllRoleRequests,
  updateRoleRequestStatus
};
