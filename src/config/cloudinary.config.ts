import { v2 as cloudinary } from "cloudinary";
import config from "./index";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName as string,
  api_key: config.cloudinary.apiKey as string,
  api_secret: config.cloudinary.apiSecret as string
});

export default cloudinary;
