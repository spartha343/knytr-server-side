import type { ErrorRequestHandler } from "express";
import config from "../../config/index.js";
import type { IGenericErrorMessage } from "../../interfaces/error.js";
import ApiError from "../../errors/ApiError.js";
import handleValidationError from "../../errors/handleValidationError.js";
import { Prisma } from "../../generated/prisma/client.js";
import handleClientError from "../../errors/handleClientError.js";

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
  config.env === "development"
    ? // eslint-disable-next-line no-console
      console.log("GlobalErrorHandler", { error })
    : // eslint-disable-next-line no-console
      console.log("GlobalErrorHandler", { error });

  let statusCode = 500;
  let message = "Something went wrong !";
  let errorMessages: IGenericErrorMessage[] = [];

  if (error instanceof Prisma.PrismaClientValidationError) {
    const simplifiedError = handleValidationError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorMessages = simplifiedError.errorMessages;
  }
  // TODO: handle that code. Just install zod and uncomment it
  // else if (error instanceof ZodError) {
  //   const simplifiedError = handleZodError(error);
  //   statusCode = simplifiedError.statusCode;
  //   message = simplifiedError.message;
  //   errorMessages = simplifiedError.errorMessages;
  // }
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const simplifiedError = handleClientError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorMessages = simplifiedError.errorMessages;
  } else if (error instanceof ApiError) {
    statusCode = error?.statusCode;
    message = error?.message;
    errorMessages = error?.message
      ? [
          {
            path: "",
            message: error?.message
          }
        ]
      : [];
  } else if (error instanceof Error) {
    message = error?.message;
    errorMessages = error?.message
      ? [
          {
            path: "",
            message: error?.message
          }
        ]
      : [];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    stack: config.env !== "production" ? error?.stack : undefined
  });
};

export default globalErrorHandler;
