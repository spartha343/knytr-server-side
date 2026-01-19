import express from "express";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { RoleController } from "./role.controller";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { RoleType } from "../../../generated/prisma/enums";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

router.get(
  "/requestable-roles-and-previous-requests",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.CUSTOMER, RoleType.VENDOR),
  RoleController.getRequestableRolesAndPreviousRequests
);

router.post(
  "/request",
  verifyFirebaseAuth,
  checkDBUser,
  RoleController.requestRole
);

router.get(
  "/requests",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.ADMIN, RoleType.SUPER_ADMIN),
  RoleController.getAllRoleRequests
);

router.patch(
  "/requests/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole(RoleType.ADMIN, RoleType.SUPER_ADMIN),
  RoleController.updateRoleRequestStatus
);

export const RoleRoutes = router;
