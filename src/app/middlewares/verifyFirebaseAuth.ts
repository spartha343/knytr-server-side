import type { RequestHandler } from "express";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { adminAuth } from "../../lib/firebaseAdmin";

export const verifyFirebaseAuth: RequestHandler = async (req, res, next) => {
  // verify firebase user

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized !");
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Token Not Found !");
    }
    const decodedUser = await adminAuth.verifyIdToken(token);

    if (!decodedUser) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Firebase User Not Found !");
    }

    req.firebaseUser = decodedUser;

    next();
  } catch (error) {
    next(error);
  }
};
