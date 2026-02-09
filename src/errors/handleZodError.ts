import { ZodError } from "zod";
import type { IGenericErrorMessage } from "../interfaces/error";
import type { IGenericErrorResponse } from "../interfaces/common";

const handleZodError = (error: ZodError): IGenericErrorResponse => {
  const errors: IGenericErrorMessage[] = error.issues.map((issue) => {
    return {
      path: issue.path.join("."),
      message: issue?.message
    };
  });

  const statusCode = 400;

  return {
    statusCode,
    message: "Validation Error",
    errorMessages: errors
  };
};

export default handleZodError;
