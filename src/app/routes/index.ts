import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { UserRoutes } from "../modules/user/user.routes.js";
import { RoleRoutes } from "../modules/role/role.route.js";
import { UploadRoutes } from "../modules/upload/upload.route.js";
import { StoreRoutes } from "../modules/store/store.route.js";
import { BranchRoutes } from "../modules/branch/branch.route.js";
import { CategoryRoutes } from "../modules/category/category.route.js";
import { BrandRoutes } from "../modules/brand/brand.route.js";
import { AttributeRoutes } from "../modules/attribute/attribute.route.js";
import { ProductRoutes } from "../modules/product/product.route.js";
import { ProductVariantRoutes } from "../modules/productVariant/productVariant.route.js";
import { InventoryRoutes } from "../modules/inventory/inventory.route.js";
import { ProductMediaRoutes } from "../modules/productMedia/productMedia.route.js";
import { CartRoutes } from "../modules/cart/cart.route.js";
import { OrderRoutes } from "../modules/order/order.route.js";

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
  },
  {
    path: "/attributes",
    route: AttributeRoutes
  },
  {
    path: "/products",
    route: ProductRoutes
  },
  {
    path: "/product-variants",
    route: ProductVariantRoutes
  },
  {
    path: "/inventory",
    route: InventoryRoutes
  },
  {
    path: "/product-media",
    route: ProductMediaRoutes
  },
  {
    path: "/cart",
    route: CartRoutes
  },
  {
    path: "/orders",
    route: OrderRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
