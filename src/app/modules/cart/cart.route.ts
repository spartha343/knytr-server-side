import express from "express";
import { CartController } from "./cart.controller";
import { CartValidation } from "./cart.validation";
import validateRequest from "../../middlewares/validateRequest";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";

const router = express.Router();

// All cart routes require authentication
router.use(verifyFirebaseAuth, checkDBUser);

// Add to cart (or update quantity if exists)
router.post(
  "/add",
  validateRequest(CartValidation.addToCart),
  CartController.addToCart
);

// Get user's cart
router.get("/", CartController.getCart);

// Update cart item quantity
router.patch(
  "/item/:itemId",
  validateRequest(CartValidation.updateCartItem),
  CartController.updateCartItem
);

// Remove cart item
router.delete("/item/:itemId", CartController.removeCartItem);

// Clear entire cart
router.delete("/clear", CartController.clearCart);

// Sync guest cart to DB after login
router.post(
  "/sync",
  validateRequest(CartValidation.syncCart),
  CartController.syncCart
);

export const CartRoutes = router;
