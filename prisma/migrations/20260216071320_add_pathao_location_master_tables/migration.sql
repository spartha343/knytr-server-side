/*
  Warnings:

  - You are about to drop the column `actualDeliveryDate` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedDeliveryDate` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoConsignmentId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoStatus` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `amountToCollect` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `consignmentId` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryCharge` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryType` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `itemDescription` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `itemQuantity` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `itemType` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `itemWeight` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `lastRetryAt` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoStatus` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `recipientArea` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `recipientCity` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `recipientZone` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `retryCount` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `specialInstruction` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `pathao_deliveries` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[consignment_id]` on the table `pathao_deliveries` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount_to_collect` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `item_quantity` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `item_weight` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_address` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_area` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_city` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_name` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_phone` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_zone` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "pathao_deliveries_consignmentId_idx";

-- DropIndex
DROP INDEX "pathao_deliveries_consignmentId_key";

-- DropIndex
DROP INDEX "pathao_deliveries_retryCount_idx";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "actualDeliveryDate",
DROP COLUMN "estimatedDeliveryDate",
DROP COLUMN "pathaoConsignmentId",
DROP COLUMN "pathaoStatus";

-- AlterTable
ALTER TABLE "pathao_deliveries" DROP COLUMN "amountToCollect",
DROP COLUMN "consignmentId",
DROP COLUMN "createdAt",
DROP COLUMN "deliveryCharge",
DROP COLUMN "deliveryType",
DROP COLUMN "errorMessage",
DROP COLUMN "invoiceId",
DROP COLUMN "itemDescription",
DROP COLUMN "itemQuantity",
DROP COLUMN "itemType",
DROP COLUMN "itemWeight",
DROP COLUMN "lastRetryAt",
DROP COLUMN "pathaoStatus",
DROP COLUMN "recipientArea",
DROP COLUMN "recipientCity",
DROP COLUMN "recipientZone",
DROP COLUMN "retryCount",
DROP COLUMN "specialInstruction",
DROP COLUMN "updatedAt",
ADD COLUMN     "amount_to_collect" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "cod_charge" DECIMAL(10,2),
ADD COLUMN     "consignment_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "delivery_fee" DECIMAL(10,2),
ADD COLUMN     "delivery_type" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "discount" DECIMAL(10,2),
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "invoice_id" TEXT,
ADD COLUMN     "item_description" TEXT,
ADD COLUMN     "item_quantity" INTEGER NOT NULL,
ADD COLUMN     "item_type" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "item_weight" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "last_retry_at" TIMESTAMP(3),
ADD COLUMN     "promo_discount" DECIMAL(10,2),
ADD COLUMN     "recipient_address" TEXT NOT NULL,
ADD COLUMN     "recipient_area" INTEGER NOT NULL,
ADD COLUMN     "recipient_city" INTEGER NOT NULL,
ADD COLUMN     "recipient_name" TEXT NOT NULL,
ADD COLUMN     "recipient_phone" TEXT NOT NULL,
ADD COLUMN     "recipient_secondary_phone" TEXT,
ADD COLUMN     "recipient_zone" INTEGER NOT NULL,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "special_instruction" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "pathao_stores" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "otp_number" TEXT,
ADD COLUMN     "secondary_contact" TEXT;

-- CreateTable
CREATE TABLE "pathao_cities" (
    "id" TEXT NOT NULL,
    "city_id" INTEGER NOT NULL,
    "city_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_zones" (
    "id" TEXT NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "zone_name" TEXT NOT NULL,
    "city_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathao_areas" (
    "id" TEXT NOT NULL,
    "area_id" INTEGER NOT NULL,
    "area_name" TEXT NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "home_delivery_available" BOOLEAN NOT NULL DEFAULT true,
    "pickup_available" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathao_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pathao_cities_city_id_key" ON "pathao_cities"("city_id");

-- CreateIndex
CREATE INDEX "pathao_cities_city_id_idx" ON "pathao_cities"("city_id");

-- CreateIndex
CREATE INDEX "pathao_cities_is_active_idx" ON "pathao_cities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pathao_zones_zone_id_key" ON "pathao_zones"("zone_id");

-- CreateIndex
CREATE INDEX "pathao_zones_city_id_idx" ON "pathao_zones"("city_id");

-- CreateIndex
CREATE INDEX "pathao_zones_zone_id_idx" ON "pathao_zones"("zone_id");

-- CreateIndex
CREATE INDEX "pathao_zones_is_active_idx" ON "pathao_zones"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pathao_areas_area_id_key" ON "pathao_areas"("area_id");

-- CreateIndex
CREATE INDEX "pathao_areas_zone_id_idx" ON "pathao_areas"("zone_id");

-- CreateIndex
CREATE INDEX "pathao_areas_area_id_idx" ON "pathao_areas"("area_id");

-- CreateIndex
CREATE INDEX "pathao_areas_is_active_idx" ON "pathao_areas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pathao_deliveries_consignment_id_key" ON "pathao_deliveries"("consignment_id");

-- CreateIndex
CREATE INDEX "pathao_deliveries_consignment_id_idx" ON "pathao_deliveries"("consignment_id");

-- CreateIndex
CREATE INDEX "pathao_deliveries_retry_count_idx" ON "pathao_deliveries"("retry_count");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_city_idx" ON "pathao_deliveries"("recipient_city");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_zone_idx" ON "pathao_deliveries"("recipient_zone");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_area_idx" ON "pathao_deliveries"("recipient_area");

-- CreateIndex
CREATE INDEX "pathao_stores_city_id_idx" ON "pathao_stores"("city_id");

-- CreateIndex
CREATE INDEX "pathao_stores_zone_id_idx" ON "pathao_stores"("zone_id");

-- CreateIndex
CREATE INDEX "pathao_stores_area_id_idx" ON "pathao_stores"("area_id");

-- AddForeignKey
ALTER TABLE "pathao_stores" ADD CONSTRAINT "pathao_stores_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "pathao_cities"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_stores" ADD CONSTRAINT "pathao_stores_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "pathao_zones"("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_stores" ADD CONSTRAINT "pathao_stores_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "pathao_areas"("area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_city_fkey" FOREIGN KEY ("recipient_city") REFERENCES "pathao_cities"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_zone_fkey" FOREIGN KEY ("recipient_zone") REFERENCES "pathao_zones"("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_area_fkey" FOREIGN KEY ("recipient_area") REFERENCES "pathao_areas"("area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_zones" ADD CONSTRAINT "pathao_zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "pathao_cities"("city_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_areas" ADD CONSTRAINT "pathao_areas_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "pathao_zones"("zone_id") ON DELETE CASCADE ON UPDATE CASCADE;
