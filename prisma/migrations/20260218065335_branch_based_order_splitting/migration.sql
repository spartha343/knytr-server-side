/*
  Warnings:

  - You are about to drop the column `branchId` on the `order_items` table. All the data in the column will be lost.
  - Made the column `assignedBranchId` on table `orders` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_branchId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_assignedBranchId_fkey";

-- DropIndex
DROP INDEX "order_items_branchId_idx";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "branchId";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "assignedBranchId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedBranchId_fkey" FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
