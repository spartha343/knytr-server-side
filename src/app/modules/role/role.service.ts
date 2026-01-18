import { prisma } from "../../../shared/prisma";
import type { UserWithRoles } from "./role.interface";
import { RoleType } from "../../../generated/prisma/client";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
/**
 * Define your business rules here.
 * Each key is a role, the value is an array of roles that this role can request.
 */
const roleRequestRules: Record<RoleType, RoleType[]> = {
  CUSTOMER: [RoleType.VENDOR], // CUSTOMER can request VENDOR
  VENDOR: [], // VENDOR cannot request anything for now
  ADMIN: [], // ADMIN cannot request anything for now
  SUPER_ADMIN: [] // SUPER_ADMIN cannot request anything
};

const getRequestableRolesAndPreviousRequests = async (
  dbUser: UserWithRoles
) => {
  const userRoles = dbUser.userRoles.map((ur) => ur.role.name);

  // Use a Set to avoid duplicates if user has multiple roles
  const requestableRoles = new Set<RoleType>();

  userRoles.forEach((role) => {
    const allowed = roleRequestRules[role] || [];
    allowed.forEach((r) => requestableRoles.add(r));
  });

  let roles: {
    name: RoleType;
    id: string;
    description: string | null;
  }[] = [];
  if (requestableRoles.size !== 0) {
    // Fetch Role details from DB
    roles = await prisma.role.findMany({
      where: { name: { in: Array.from(requestableRoles) } }
    });
  }

  const previousRequests = await prisma.roleRequest.findMany({
    where: { userId: dbUser.id },
    include: { role: true },
    orderBy: { createdAt: "desc" }
  });

  return {
    requestableRoles: roles,
    previousRequests: previousRequests.map((req) => ({
      id: req.role.id,
      role: req.role,
      status: req.status,
      requestedAt: req.createdAt
    }))
  };
};

const requestRole = async (dbUser: UserWithRoles, roleId: string) => {
  // 1. Check role exists
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new ApiError(httpStatus.NOT_FOUND, "Role not found");
  }

  // 2. Check user already has role
  const hasRole = dbUser.userRoles.some((ur) => ur.roleId === roleId);
  if (hasRole) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You already have this role");
  }

  // 3. Check existing request
  const existingRequest = await prisma.roleRequest.findUnique({
    where: {
      userId_roleId: {
        userId: dbUser.id,
        roleId
      }
    }
  });

  if (existingRequest) {
    if (existingRequest.status === "PENDING") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Role request already pending"
      );
    }

    if (existingRequest.status === "APPROVED") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Role already approved");
    }
  }

  // 4. Business rule: CUSTOMER → VENDOR only
  const userRoleNames = dbUser.userRoles.map((ur) => ur.role.name);

  if (role.name === "VENDOR" && !userRoleNames.includes("CUSTOMER")) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to request this role"
    );
  }

  // 5. Create request
  return prisma.roleRequest.create({
    data: {
      userId: dbUser.id,
      roleId
    },
    include: {
      role: true
    }
  });
};

export const RoleService = {
  getRequestableRolesAndPreviousRequests,
  requestRole
};
