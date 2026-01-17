import { DecodedIdToken } from "firebase-admin/auth";
import type { RoleType, User } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken;
      dbUser?: User & {
        userRoles: {
          role: {
            name: RoleType;
          };
        }[];
      };
    }
  }
}
