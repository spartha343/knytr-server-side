import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { UserRoutes } from "../modules/user/user.routes.js";
import { RoleRoutes } from "../modules/role/role.route.js";
import { UploadRoutes } from "../modules/upload/upload.route.js";
import { StoreRoutes } from "../modules/store/store.route.js";
import { BranchRoutes } from "../modules/branch/branch.route.js";
import { CategoryRoutes } from "../modules/category/category.route.js";
import { BrandRoutes } from "../modules/brand/brand.route.js";

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
  },
  {
    path: "/upload",
    route: UploadRoutes
  },
  {
    path: "/stores",
    route: StoreRoutes
  },
  {
    path: "/branches",
    route: BranchRoutes
  },
  {
    path: "/categories",
    route: CategoryRoutes
  },
  {
    path: "/brands",
    route: BrandRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
