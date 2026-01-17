import { adminAuth } from "../lib/firebaseAdmin";

export const verifyFirebaseToken = async (token: string) => {
  if (!token) {
    throw new Error("No token provided !");
  }
  return adminAuth.verifyIdToken(token);
};
