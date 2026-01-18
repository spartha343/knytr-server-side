import type { Prisma } from "../../../generated/prisma/client";

// Full payload including userRoles.userId and roleId
export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true; // includes id, name, description
      };
    };
  };
}>;
