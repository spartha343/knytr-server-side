import { prisma } from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import httpStatus from "http-status";
import type {
  ICreateInventoryRequest,
  IUpdateInventoryRequest,
  IAdjustStockRequest,
  IBulkCreateInventoryRequest
} from "./inventory.interface";
import type { Inventory } from "../../../generated/prisma/client";

const createInventory = async (
  userId: string,
  payload: ICreateInventoryRequest
): Promise<Inventory> => {
  // Verify variant exists and user owns it
  const variant = await prisma.productVariant.findUnique({
    where: { id: payload.variantId },
    include: {
      product: {
        include: {
          store: true
        }
      }
    }
  });

  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  if (variant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only manage inventory for your own products"
    );
  }

  // Verify branch exists and belongs to the same store
  const branch = await prisma.branch.findUnique({
    where: { id: payload.branchId, isDeleted: false }
  });

  if (!branch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Branch not found");
  }

  if (branch.storeId !== variant.product.storeId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Branch must belong to the same store as the product"
    );
  }

  // Check if inventory already exists for this variant-branch combination
  const existingInventory = await prisma.inventory.findUnique({
    where: {
      variantId_branchId: {
        variantId: payload.variantId,
        branchId: payload.branchId
      }
    }
  });

  if (existingInventory) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Inventory already exists for this variant at this branch. Use update instead."
    );
  }

  const result = await prisma.inventory.create({
    data: payload,
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          variantAttributes: {
            include: {
              attributeValue: {
                include: {
                  attribute: true
                }
              }
            }
          }
        }
      },
      branch: {
        select: {
          id: true,
          name: true,
          storeId: true
        }
      }
    }
  });

  return result;
};

const bulkCreateInventory = async (
  userId: string,
  payload: IBulkCreateInventoryRequest
): Promise<Inventory[]> => {
  // Verify variant exists and user owns it
  const variant = await prisma.productVariant.findUnique({
    where: { id: payload.variantId },
    include: {
      product: {
        include: {
          store: {
            include: {
              branches: {
                where: { isDeleted: false }
              }
            }
          }
        }
      }
    }
  });

  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  if (variant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only manage inventory for your own products"
    );
  }

  const storeBranchIds = variant.product.store.branches.map((b) => b.id);
  const requestedBranchIds = payload.inventories.map((inv) => inv.branchId);

  // Verify all branches belong to the store
  const invalidBranches = requestedBranchIds.filter(
    (id) => !storeBranchIds.includes(id)
  );

  if (invalidBranches.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "All branches must belong to the same store as the product"
    );
  }

  // Check for existing inventories
  const existingInventories = await prisma.inventory.findMany({
    where: {
      variantId: payload.variantId,
      branchId: { in: requestedBranchIds }
    }
  });

  if (existingInventories.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Inventory already exists for some branches: ${existingInventories.map((i) => i.branchId).join(", ")}`
    );
  }

  // Create all inventories
  const results: Inventory[] = [];

  for (const inventoryData of payload.inventories) {
    const inventory = await prisma.inventory.create({
      data: {
        variantId: payload.variantId,
        ...inventoryData
      },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    results.push(inventory);
  }

  return results;
};

const getInventoryByVariant = async (
  variantId: string
): Promise<Inventory[]> => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId }
  });

  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  const result = await prisma.inventory.findMany({
    where: { variantId },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          contactPhone: true,
          address: true
        }
      }
    },
    orderBy: {
      branch: {
        name: "asc"
      }
    }
  });

  return result;
};

const getInventoryByBranch = async (branchId: string): Promise<Inventory[]> => {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId, isDeleted: false }
  });

  if (!branch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Branch not found");
  }

  const result = await prisma.inventory.findMany({
    where: { branchId },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          variantAttributes: {
            include: {
              attributeValue: {
                include: {
                  attribute: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result;
};

const getLowStockItems = async (userId: string): Promise<Inventory[]> => {
  // Get user's stores
  const stores = await prisma.store.findMany({
    where: {
      vendorId: userId,
      isDeleted: false
    },
    include: {
      branches: {
        where: { isDeleted: false },
        select: { id: true }
      }
    }
  });

  const branchIds = stores.flatMap((store) => store.branches.map((b) => b.id));

  // Get all inventory for user's branches
  const allInventory = await prisma.inventory.findMany({
    where: {
      branchId: { in: branchIds }
    },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          variantAttributes: {
            include: {
              attributeValue: {
                include: {
                  attribute: true
                }
              }
            }
          }
        }
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  // Filter for low stock items (quantity <= lowStockAlert)
  const lowStockItems = allInventory.filter(
    (item) => item.quantity <= item.lowStockAlert
  );

  // Sort by quantity ascending (lowest stock first)
  return lowStockItems.sort((a, b) => a.quantity - b.quantity);
};

const updateInventory = async (
  id: string,
  userId: string,
  payload: IUpdateInventoryRequest
): Promise<Inventory> => {
  const existingInventory = await prisma.inventory.findUnique({
    where: { id },
    include: {
      variant: {
        include: {
          product: {
            include: {
              store: true
            }
          }
        }
      }
    }
  });

  if (!existingInventory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Inventory record not found");
  }

  if (existingInventory.variant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only update inventory for your own products"
    );
  }

  const result = await prisma.inventory.update({
    where: { id },
    data: payload,
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return result;
};

const adjustStock = async (
  id: string,
  userId: string,
  payload: IAdjustStockRequest
): Promise<Inventory> => {
  const existingInventory = await prisma.inventory.findUnique({
    where: { id },
    include: {
      variant: {
        include: {
          product: {
            include: {
              store: true
            }
          }
        }
      }
    }
  });

  if (!existingInventory) {
    throw new ApiError(httpStatus.NOT_FOUND, "Inventory record not found");
  }

  if (existingInventory.variant.product.store.vendorId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You can only adjust inventory for your own products"
    );
  }

  const newQuantity = existingInventory.quantity + payload.quantity;

  if (newQuantity < 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot adjust stock. Result would be negative. Current: ${existingInventory.quantity}, Adjustment:
${payload.quantity}`
    );
  }

  const result = await prisma.inventory.update({
    where: { id },
    data: {
      quantity: newQuantity
    },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return result;
};

export const InventoryService = {
  createInventory,
  bulkCreateInventory,
  getInventoryByVariant,
  getInventoryByBranch,
  getLowStockItems,
  updateInventory,
  adjustStock
};
