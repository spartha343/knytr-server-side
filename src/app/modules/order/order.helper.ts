/**
 * Order Helper Functions
 * Helper utilities for order processing, including branch assignment
 */

import {
  groupCartItemsByStoreAndBranch,
  type CartItemWithInventory
} from "../../../utils/branchAssignment";
import type { PrismaClient } from "../../../generated/prisma/client";

export interface OrderGroupResult {
  storeId: string;
  branchAssignments: {
    branchId: string;
    order_items: {
      productId: string;
      variantId: string | null;
      quantity: number;
    }[];
  }[];
}

/**
 * Calculate how cart items should be split into orders by branch
 */
export async function calculateOrdersFromCart(
  cartItems: CartItemWithInventory[]
): Promise<OrderGroupResult[]> {
  const storeAndBranchGroups = await groupCartItemsByStoreAndBranch(cartItems);

  const results: OrderGroupResult[] = [];

  storeAndBranchGroups.forEach((branchAssignments, storeId) => {
    const branchGroups = branchAssignments.map((assignment) => ({
      branchId: assignment.branchId,
      order_items: assignment.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      }))
    }));

    results.push({
      storeId,
      branchAssignments: branchGroups
    });
  });

  return results;
}

/**
 * Generate unique order number with format: ORD-YYYYMMDD-XXXX
 * Uses database sequence to ensure uniqueness even with concurrent requests
 */
export async function generateOrderNumber(
  prismaClient:
    | PrismaClient
    | Omit<
        PrismaClient,
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
      >
): Promise<string> {
  const today = new Date();
  const isoString = today.toISOString().split("T")[0];
  if (!isoString) {
    throw new Error("Failed to generate date string");
  }
  const dateStr = isoString.replace(/-/g, ""); // YYYYMMDD format

  // Use upsert with atomic increment to handle race conditions
  const sequence = await prismaClient.orderSequence.upsert({
    where: { date: dateStr },
    create: {
      date: dateStr,
      sequence: 1
    },
    update: {
      sequence: { increment: 1 }
    }
  });

  // Format: ORD-20260220-0001
  const paddedSequence = String(sequence.sequence).padStart(4, "0");
  return `ORD-${dateStr}-${paddedSequence}`;
}

/**
 * Log order activity for audit trail
 */
export async function logOrderActivity(
  prismaClient:
    | PrismaClient
    | Omit<
        PrismaClient,
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
      >,
  orderId: string,
  userId: string | undefined,
  action: string,
  description?: string
): Promise<void> {
  await prismaClient.orderActivity.create({
    data: {
      orderId,
      userId: userId || null,
      action,
      description: description || null
    }
  });
}
/**
 * Validate if status transition is allowed
 */
export function canTransitionStatus(
  currentStatus: string,
  newStatus: string,
  validTransitions: Record<string, string[]>
): boolean {
  const allowedTransitions = validTransitions[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Check if order can be cancelled based on current status
 */
export function canCancelOrder(currentStatus: string): boolean {
  const cancellableStatuses = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY_FOR_PICKUP"
  ];
  return cancellableStatuses.includes(currentStatus);
}

/**
 * Check if Pathao delivery has been requested
 */
export function hasPathaoDelivery(order: {
  pathaoDelivery?: unknown;
}): boolean {
  return !!order.pathaoDelivery;
}
