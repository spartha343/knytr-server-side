import express from "express";
import { OrderController } from "./order.controller";
import { OrderValidation } from "./order.validation";
import validateRequest from "../../middlewares/validateRequest";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { checkDBUser } from "../../middlewares/checkDBUser";
import { requireRole } from "../../middlewares/requireRole";

const router = express.Router();

// PUBLIC ROUTES (No authentication required)

// CREATE ORDER - Public (for guest checkout)
router.post(
  "/public/create",
  validateRequest(OrderValidation.createOrderZodSchema),
  OrderController.createOrder
);

// AUTHENTICATED ROUTES

// CREATE ORDER - Authenticated (for logged-in users)
router.post(
  "/",
  verifyFirebaseAuth,
  checkDBUser,
  validateRequest(OrderValidation.createOrderZodSchema),
  OrderController.createOrder
);

// Create manual order (Vendor only) <-- NEW ROUTE
router.post(
  "/manual",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR"),
  validateRequest(OrderValidation.createManualOrderZodSchema),
  OrderController.createManualOrder
);

// GET ALL ORDERS (Admin only)
router.get(
  "/admin/all",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("ADMIN", "SUPER_ADMIN"),
  OrderController.getAllOrders
);

// GET VENDOR ORDERS (Vendor only - their store's orders)
router.get(
  "/vendor/my-orders",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR"),
  OrderController.getVendorOrders
);

// GET CUSTOMER ORDERS (Customer only - their own orders)
router.get(
  "/customer/my-orders",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("CUSTOMER", "VENDOR", "ADMIN", "SUPER_ADMIN"),
  OrderController.getCustomerOrders
);

// GET ORDER BY ID
router.get(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  OrderController.getOrderById
);

// Generate invoice PDF
router.get(
  "/:id/invoice",
  verifyFirebaseAuth,
  checkDBUser,
  OrderController.generateInvoice
);

// UPDATE ORDER (Vendor only - before voice confirmation)
router.patch(
  "/:id",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR"),
  validateRequest(OrderValidation.updateOrderZodSchema),
  OrderController.updateOrder
);

// UPDATE ORDER STATUS (Vendor only)
router.patch(
  "/:id/status",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR"),
  validateRequest(OrderValidation.updateOrderStatusZodSchema),
  OrderController.updateOrderStatus
);

// ASSIGN BRANCH TO ORDER ITEM (Vendor only)
router.patch(
  "/:orderId/items/:itemId/assign-branch",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("VENDOR"),
  validateRequest(OrderValidation.assignBranchToItemZodSchema),
  OrderController.assignBranchToItem
);

// CANCEL ORDER (Customer can cancel PENDING, Vendor can cancel PENDING/CONFIRMED/PROCESSING/READY_FOR_PICKUP)
router.patch(
  "/:id/cancel",
  verifyFirebaseAuth,
  checkDBUser,
  requireRole("CUSTOMER", "VENDOR", "ADMIN", "SUPER_ADMIN"),
  validateRequest(OrderValidation.cancelOrderZodSchema),
  OrderController.cancelOrder
);

export const OrderRoutes = router;
