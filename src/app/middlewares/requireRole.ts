import { type RequestHandler } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import type { RoleType } from "../../generated/prisma/client";

// please use verifyFirebaseAuth and checkDBUser before using requireRole
export const requireRole =
  (...allowedRoles: RoleType[]): RequestHandler =>
  (req, res, next) => {
    const dbUser = req.dbUser;

    if (!dbUser) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const userRoles: RoleType[] = dbUser.userRoles.map(
      (ur: { role: { name: RoleType } }) => ur.role.name
    );

    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
    }

    next();
  };
