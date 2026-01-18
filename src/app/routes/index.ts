import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { UserRoutes } from "../modules/user/user.routes.js";
import { RoleRoutes } from "../modules/role/role.route.js";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes
  },
  {
    path: "/users",
    route: UserRoutes
  },
  {
    path: "/roles",
    route: RoleRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
