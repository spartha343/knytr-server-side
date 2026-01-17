import type { RequestHandler } from "express";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";

// please use verifyFirebaseAuth before using checkDBUser
export const checkDBUser: RequestHandler = async (req, res, next) => {
  if (!req.firebaseUser?.uid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { firebaseUid: req.firebaseUser.uid },
    include: {
      userRoles: {
        include: { role: true }
      }
    }
  });

  if (!dbUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not found !");
  }

  if (dbUser.status === "BLOCKED") {
    throw new ApiError(httpStatus.FORBIDDEN, "User is blocked !");
  }

  // attach DB user for next middlewares/controllers
  req.dbUser = dbUser;

  next();
};
