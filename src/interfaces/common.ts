import type { IGenericErrorMessage } from "./error";

export interface IMeta {
  limit: number;
  page: number;
  total: number;
}

export interface IGenericResponse<T> {
  meta: {
    page: number;
    limit: number;
    total: number;
  };
  data: T;
}

export interface IGenericErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: IGenericErrorMessage[];
}
