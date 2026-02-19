/**
 * Branch Assignment Algorithm for Order Splitting
 *
 * This utility handles automatic branch assignment when creating orders from cart.
 * Goal: Minimize number of orders by intelligently grouping items by branch.
 */

import { prisma } from "../shared/prisma";

export interface CartItemWithInventory {
  productId: string;
  variantId: string | null;
  quantity: number;
  storeId: string;
}

export interface BranchAssignment {
  branchId: string;
  items: CartItemWithInventory[];
}

export interface BranchInventoryInfo {
  branchId: string;
  quantity: number;
  branchName: string;
}

/**
 * Get all branches that have sufficient inventory for a cart item
 */
export async function getBranchesWithInventory(
  variantId: string,
  requiredQuantity: number,
  storeId: string
): Promise<BranchInventoryInfo[]> {
  const inventories = await prisma.inventory.findMany({
    where: {
      variantId,
      branch: {
        storeId, // Must belong to the same store
        isActive: true,
        isDeleted: false
      }
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  // Filter by available quantity (quantity - reservedQty)
  const availableInventories = inventories.filter((inv) => {
    const availableQty = inv.quantity - inv.reservedQty;
    return availableQty >= requiredQuantity;
  });

  return availableInventories.map((inv) => ({
    branchId: inv.branchId,
    quantity: inv.quantity - inv.reservedQty, // Return AVAILABLE quantity
    branchName: inv.branch.name
  }));
}

/**
 * Main algorithm: Group cart items by branch to minimize number of orders
 *
 * Algorithm:
 * 1. For each item, find all branches with sufficient inventory
 * 2. Try to assign items to branches that already have other items (grouping)
 * 3. If no common branch, assign to first available branch
 * 4. Return grouped items by branch
 */
export async function assignItemsToBranches(
  cartItems: CartItemWithInventory[]
): Promise<BranchAssignment[]> {
  const branchGroups = new Map<string, CartItemWithInventory[]>();
  const itemBranchOptions = new Map<number, BranchInventoryInfo[]>();

  // Step 1: Get all available branches for each item
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];

    if (!item) continue;

    if (!item.variantId) {
      throw new Error(`Item ${item.productId} has no variant ID`);
    }

    const availableBranches = await getBranchesWithInventory(
      item.variantId,
      item.quantity,
      item.storeId
    );

    if (availableBranches.length === 0) {
      throw new Error(
        `No branch has sufficient inventory for product variant ${item.variantId}`
      );
    }

    itemBranchOptions.set(i, availableBranches);
  }

  // Step 2: Assign items to branches (greedy algorithm for grouping)
  for (const item of cartItems) {
    // Now 'item' is guaranteed to be defined by TypeScript

    if (!item.variantId) {
      throw new Error(`Item ${item.productId} has no variant ID`);
    }

    const availableBranches = await getBranchesWithInventory(
      item.variantId,
      item.quantity,
      item.storeId
    );

    // Find if this item can go to a branch we're already using
    let assignedBranchId: string | null = null;
    for (const branchOption of availableBranches) {
      if (branchGroups.has(branchOption.branchId)) {
        assignedBranchId = branchOption.branchId;
        break;
      }
    }

    // If no existing branch works, use first available
    if (!assignedBranchId) {
      const firstBranch = availableBranches[0];
      if (!firstBranch) {
        throw new Error(`No branch has inventory for item ${item.productId}`);
      }
      assignedBranchId = firstBranch.branchId;
    }

    // Add item to the branch group
    if (!branchGroups.has(assignedBranchId)) {
      branchGroups.set(assignedBranchId, []);
    }
    const branchItems = branchGroups.get(assignedBranchId);
    if (branchItems) {
      branchItems.push(item);
    }
  }

  // Step 3: Convert map to array
  const result: BranchAssignment[] = [];
  branchGroups.forEach((items, branchId) => {
    result.push({ branchId, items });
  });

  return result;
}

/**
 * Group cart items by store first, then assign branches within each store
 */
export async function groupCartItemsByStoreAndBranch(
  cartItems: CartItemWithInventory[]
): Promise<Map<string, BranchAssignment[]>> {
  const storeGroups = new Map<string, CartItemWithInventory[]>();

  // Group by store
  for (const item of cartItems) {
    if (!storeGroups.has(item.storeId)) {
      storeGroups.set(item.storeId, []);
    }
    storeGroups.get(item.storeId)!.push(item);
  }

  // For each store, assign branches
  const result = new Map<string, BranchAssignment[]>();

  for (const [storeId, items] of storeGroups.entries()) {
    const branchAssignments = await assignItemsToBranches(items);
    result.set(storeId, branchAssignments);
  }

  return result;
}

/**
 * Calculate how many orders will be created from cart
 */
export async function calculateOrderCount(
  cartItems: CartItemWithInventory[]
): Promise<number> {
  const storeAndBranchGroups = await groupCartItemsByStoreAndBranch(cartItems);

  let totalOrders = 0;
  storeAndBranchGroups.forEach((branchAssignments) => {
    totalOrders += branchAssignments.length;
  });

  return totalOrders;
}
