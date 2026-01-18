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

export const RoleRoutes = router;
