import type { User } from "../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";

const createUser = async (data: User) => {
  const result = await prisma.user.create({ data });
  return result;
};

export const UserService = {
  createUser
};
