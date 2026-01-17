import { prisma } from "../../../shared/prisma";
import { mapUserToAuthResponse } from "./auth.utils";

interface ISyncUserInput {
  uid: string;
  email?: string;
}

const SyncUserWithRole = async (userData: ISyncUserInput) => {
  const { email, uid } = userData;

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: {
        firebaseUid: uid
      },
      update: {},
      create: {
        firebaseUid: uid,
        ...(email && { email }),
        status: "ACTIVE"
      }
    });

    const customerRole = await tx.role.upsert({
      where: {
        name: "CUSTOMER"
      },
      update: {},
      create: {
        name: "CUSTOMER",
        description: "Default user role."
      }
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: customerRole.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: customerRole.id
      }
    });

    const fullUser = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!fullUser) return null;

    return mapUserToAuthResponse(fullUser);
  });
};

export const AuthService = {
  SyncUserWithRole
};
