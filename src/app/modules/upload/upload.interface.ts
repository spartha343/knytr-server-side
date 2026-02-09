export interface IUploadResponse {
  success: boolean;
  message: string;
  url?: string;
  urls?: string[];
  publicId?: string;
  publicIds?: string[];
}
