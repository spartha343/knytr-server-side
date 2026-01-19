import { prisma } from "../../../shared/prisma";
import type { IRoleFilterRequest, UserWithRoles } from "./role.interface";
import { Prisma, RoleType } from "../../../generated/prisma/client";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type { IPaginationOptions } from "../../../interfaces/pagination";
import { paginationHelpers } from "../../../helpers/paginationHelper";
import dayjs from "dayjs";
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
      id: req.id,
      role: req.role,
      status: req.status,
      requestedAt: req.createdAt,
      updatedAt: req.updatedAt
    }))
  };
};

const COOLDOWN_DAYS = 3;
const requestRole = async (dbUser: UserWithRoles, roleId: string) => {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new ApiError(httpStatus.NOT_FOUND, "Role not found");
  }

  const hasRole = dbUser.userRoles.some((ur) => ur.roleId === roleId);
  if (hasRole) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You already have this role");
  }

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
      throw new ApiError(httpStatus.CONFLICT, "Role request already pending");
    }

    if (existingRequest.status === "APPROVED") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Role already approved");
    }

    if (existingRequest.status === "REJECTED") {
      const daysSinceRejection = dayjs().diff(existingRequest.updatedAt, "day");

      if (daysSinceRejection < COOLDOWN_DAYS) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          `You can reapply after ${COOLDOWN_DAYS - daysSinceRejection} day(s)`
        );
      }

      // cooldown passed → allow reapply
      await prisma.roleRequest.delete({
        where: { id: existingRequest.id }
      });
    }
  }

  // business rule check (CUSTOMER → VENDOR)
  const userRoleNames = dbUser.userRoles.map((ur) => ur.role.name);
  if (role.name === "VENDOR" && !userRoleNames.includes("CUSTOMER")) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to request this role"
    );
  }

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

const getAllRoleRequests = async (
  filters: IRoleFilterRequest,
  options: IPaginationOptions
) => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.RoleRequestWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          role: {
            name: {
              equals: searchTerm as RoleType
            }
          }
        },
        {
          role: {
            description: {
              contains: searchTerm,
              mode: Prisma.QueryMode.insensitive
            }
          }
        },
        {
          user: {
            email: {
              contains: searchTerm,
              mode: Prisma.QueryMode.insensitive
            }
          }
        }
      ]
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          equals: (filterData as any)[key]
        }
      }))
    });
  }

  const whereConditions: Prisma.RoleRequestWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.roleRequest.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder
    },
    include: {
      role: true,
      user: true
    }
  });

  const total = await prisma.roleRequest.count({
    where: whereConditions
  });

  return {
    meta: {
      total,
      page,
      limit
    },
    data: result
  };
};

const updateRoleRequestStatus = async (
  requestId: string,
  status: "APPROVED" | "REJECTED"
) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.roleRequest.findUnique({
      where: { id: requestId },
      include: { role: true }
    });

    if (!request) {
      throw new ApiError(httpStatus.NOT_FOUND, "Role request not found");
    }

    if (request.status !== "PENDING") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only pending requests can be updated"
      );
    }

    const updated = await tx.roleRequest.update({
      where: { id: requestId },
      data: { status }
    });

    if (status === "APPROVED") {
      await tx.userRole.create({
        data: {
          userId: request.userId,
          roleId: request.roleId
        }
      });
    }

    return updated;
  });
};

export const RoleService = {
  getRequestableRolesAndPreviousRequests,
  requestRole,
  getAllRoleRequests,
  updateRoleRequestStatus
};
