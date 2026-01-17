import type { RoleType } from "../../../generated/prisma/enums";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapUserToAuthResponse = (user: any) => {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user?.email,
    status: user.status,
    roles: user?.userRoles?.map(
      (ur: { role: { name: RoleType } }) => ur.role.name
    )
  };
};
