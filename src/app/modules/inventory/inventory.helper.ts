import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type { PrismaClient } from "../../../generated/prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/**
 * Calculate available inventory (quantity - reservedQty)
 */
export const calculateAvailableInventory = (
  quantity: number,
  reservedQty: number
): number => {
  return Math.max(0, quantity - reservedQty);
};

/**
 * Get inventory for a variant in a specific branch
 */
export const getInventoryForVariant = async (
  variantId: string,
  branchId: string,
  tx?: TransactionClient
) => {
  const client = tx || prisma;
  const inventory = await client.inventory.findUnique({
    where: {
      variantId_branchId: {
        variantId,
        branchId
      }
    }
  });

  return inventory;
};

/**
 * Check if sufficient stock is available for an order item
 */
export const checkStockAvailability = async (
  variantId: string,
  branchId: string,
  requestedQuantity: number,
  tx?: TransactionClient
): Promise<{ available: boolean; availableQty: number }> => {
  const inventory = await getInventoryForVariant(variantId, branchId, tx);

  if (!inventory) {
    return { available: false, availableQty: 0 };
  }

  const availableQty = calculateAvailableInventory(
    inventory.quantity,
    inventory.reservedQty
  );

  return {
    available: availableQty >= requestedQuantity,
    availableQty
  };
};

/**
 * Reserve inventory for an order item (increment reservedQty)
 */
export const reserveInventory = async (
  variantId: string,
  branchId: string,
  quantity: number,
  tx?: TransactionClient
): Promise<void> => {
  const client = tx || prisma;

  // First check if enough stock is available
  const { available, availableQty } = await checkStockAvailability(
    variantId,
    branchId,
    quantity,
    tx
  );

  if (!available) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Insufficient stock. Requested: ${quantity}, Available: ${availableQty}`
    );
  }

  // Reserve the inventory
  await client.inventory.update({
    where: {
      variantId_branchId: {
        variantId,
        branchId
      }
    },
    data: {
      reservedQty: {
        increment: quantity
      }
    }
  });
};

/**
 * Release reserved inventory (decrement reservedQty)
 */
export const releaseInventory = async (
  variantId: string,
  branchId: string,
  quantity: number,
  tx?: TransactionClient
): Promise<void> => {
  const client = tx || prisma;
  const inventory = await getInventoryForVariant(variantId, branchId, tx);

  if (!inventory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Inventory record not found");
  }

  // Make sure we don't go below zero
  const newReservedQty = Math.max(0, inventory.reservedQty - quantity);

  await client.inventory.update({
    where: {
      variantId_branchId: {
        variantId,
        branchId
      }
    },
    data: {
      reservedQty: newReservedQty
    }
  });
};

/**
 * Reserve inventory for multiple order items
 */
export const reserveInventoryBulk = async (
  items: { variantId: string; branchId: string; quantity: number }[],
  tx?: TransactionClient
): Promise<void> => {
  // Validate all items first
  for (const item of items) {
    const { available, availableQty } = await checkStockAvailability(
      item.variantId,
      item.branchId,
      item.quantity,
      tx
    );

    if (!available) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient stock for variant ${item.variantId}. Requested: ${item.quantity}, Available: ${availableQty}`
      );
    }
  }

  // All items have sufficient stock, now reserve them
  for (const item of items) {
    await reserveInventory(item.variantId, item.branchId, item.quantity, tx);
  }
};

/**
 * Release inventory for multiple order items
 */
export const releaseInventoryBulk = async (
  items: { variantId: string; branchId: string; quantity: number }[],
  tx?: TransactionClient
): Promise<void> => {
  for (const item of items) {
    await releaseInventory(item.variantId, item.branchId, item.quantity, tx);
  }
};
