-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_assignedBranchId_fkey";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ALTER COLUMN "assignedBranchId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "order_activities" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_activities_orderId_idx" ON "order_activities"("orderId");

-- CreateIndex
CREATE INDEX "order_activities_userId_idx" ON "order_activities"("userId");

-- CreateIndex
CREATE INDEX "order_activities_action_idx" ON "order_activities"("action");

-- CreateIndex
CREATE INDEX "order_activities_createdAt_idx" ON "order_activities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_sequences_date_key" ON "order_sequences"("date");

-- CreateIndex
CREATE INDEX "order_items_branchId_idx" ON "order_items"("branchId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedBranchId_fkey" FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
