import type { Response } from "express";

interface IApiResponse<T> {
  statusCode: number;
  success: boolean;
  message: string | null;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
  data?: T | null;
}

const sendResponse = <T>(res: Response, data: IApiResponse<T>): void => {
  const responseData: IApiResponse<T> = {
    statusCode: data.statusCode,
    success: data.success,
    message: data.message || null,
    ...(data.meta && { meta: data.meta }),
    ...(data.data !== undefined && { data: data.data })
  };

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
