-- CreateTable
CREATE TABLE "pathao_credentials" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_stores" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "pathaoStoreId" INTEGER NOT NULL,
    "pathaoCityId" INTEGER NOT NULL,
    "pathaoZoneId" INTEGER NOT NULL,
    "pathaoAreaId" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_deliveries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "consignmentId" TEXT,
    "invoiceId" TEXT,
    "pathaoStoreId" INTEGER NOT NULL,
    "itemWeight" DECIMAL(10,2) NOT NULL,
    "itemQuantity" INTEGER NOT NULL,
    "deliveryCharge" DECIMAL(10,2) NOT NULL,
    "amountToCollect" DECIMAL(10,2) NOT NULL,
    "recipientCity" INTEGER NOT NULL,
    "recipientZone" INTEGER NOT NULL,
    "recipientArea" INTEGER NOT NULL,
    "deliveryType" INTEGER NOT NULL DEFAULT 48,
    "itemType" INTEGER NOT NULL DEFAULT 2,
    "specialInstruction" TEXT,
    "itemDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pathaoStatus" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_delivery_status_history" (
    "id" TEXT NOT NULL,
    "pathaoDeliveryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pathaoStatus" TEXT,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pathao_delivery_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_webhook_logs" (
    "id" TEXT NOT NULL,
    "consignmentId" TEXT,
    "merchantOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pathao_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pathao_stores_branchId_key" ON "pathao_stores"("branchId");

-- CreateIndex
CREATE INDEX "pathao_stores_branchId_idx" ON "pathao_stores"("branchId");

-- CreateIndex
CREATE INDEX "pathao_stores_pathaoStoreId_idx" ON "pathao_stores"("pathaoStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "pathao_deliveries_orderId_key" ON "pathao_deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "pathao_deliveries_consignmentId_key" ON "pathao_deliveries"("consignmentId");

-- CreateIndex
CREATE INDEX "pathao_deliveries_orderId_idx" ON "pathao_deliveries"("orderId");

-- CreateIndex
CREATE INDEX "pathao_deliveries_consignmentId_idx" ON "pathao_deliveries"("consignmentId");

-- CreateIndex
CREATE INDEX "pathao_deliveries_status_idx" ON "pathao_deliveries"("status");

-- CreateIndex
CREATE INDEX "pathao_deliveries_retryCount_idx" ON "pathao_deliveries"("retryCount");

-- CreateIndex
CREATE INDEX "pathao_delivery_status_history_pathaoDeliveryId_idx" ON "pathao_delivery_status_history"("pathaoDeliveryId");

-- CreateIndex
CREATE INDEX "pathao_delivery_status_history_createdAt_idx" ON "pathao_delivery_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "pathao_webhook_logs_consignmentId_idx" ON "pathao_webhook_logs"("consignmentId");

-- CreateIndex
CREATE INDEX "pathao_webhook_logs_merchantOrderId_idx" ON "pathao_webhook_logs"("merchantOrderId");

-- CreateIndex
CREATE INDEX "pathao_webhook_logs_processed_idx" ON "pathao_webhook_logs"("processed");

-- CreateIndex
CREATE INDEX "pathao_webhook_logs_createdAt_idx" ON "pathao_webhook_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "pathao_stores" ADD CONSTRAINT "pathao_stores_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_delivery_status_history" ADD CONSTRAINT "pathao_delivery_status_history_pathaoDeliveryId_fkey" FOREIGN KEY ("pathaoDeliveryId") REFERENCES "pathao_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
