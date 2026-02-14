/*
  Warnings:

  - The values [PLACED,VOICE_CONFIRMED,VENDOR_CONFIRMED,READY_TO_SHIP] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED');
ALTER TABLE "public"."orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "actualDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "assignedBranchId" TEXT,
ADD COLUMN     "estimatedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "pathaoConsignmentId" TEXT,
ADD COLUMN     "pathaoStatus" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "orders_assignedBranchId_idx" ON "orders"("assignedBranchId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedBranchId_fkey" FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
