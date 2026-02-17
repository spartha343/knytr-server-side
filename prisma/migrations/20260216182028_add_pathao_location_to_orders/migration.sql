/*
  Warnings:

  - You are about to drop the column `recipient_area` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_city` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_zone` on the `pathao_deliveries` table. All the data in the column will be lost.
  - Added the required column `recipient_area_id` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_city_id` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient_zone_id` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pathao_deliveries" DROP CONSTRAINT "pathao_deliveries_recipient_area_fkey";

-- DropForeignKey
ALTER TABLE "pathao_deliveries" DROP CONSTRAINT "pathao_deliveries_recipient_city_fkey";

-- DropForeignKey
ALTER TABLE "pathao_deliveries" DROP CONSTRAINT "pathao_deliveries_recipient_zone_fkey";

-- DropIndex
DROP INDEX "pathao_deliveries_recipient_area_idx";

-- DropIndex
DROP INDEX "pathao_deliveries_recipient_city_idx";

-- DropIndex
DROP INDEX "pathao_deliveries_recipient_zone_idx";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "recipient_area_id" INTEGER,
ADD COLUMN     "recipient_city_id" INTEGER,
ADD COLUMN     "recipient_zone_id" INTEGER;

-- AlterTable
ALTER TABLE "pathao_deliveries" DROP COLUMN "recipient_area",
DROP COLUMN "recipient_city",
DROP COLUMN "recipient_zone",
ADD COLUMN     "recipient_area_id" INTEGER NOT NULL,
ADD COLUMN     "recipient_city_id" INTEGER NOT NULL,
ADD COLUMN     "recipient_zone_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "orders_recipient_city_id_idx" ON "orders"("recipient_city_id");

-- CreateIndex
CREATE INDEX "orders_recipient_zone_id_idx" ON "orders"("recipient_zone_id");

-- CreateIndex
CREATE INDEX "orders_recipient_area_id_idx" ON "orders"("recipient_area_id");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_city_id_idx" ON "pathao_deliveries"("recipient_city_id");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_zone_id_idx" ON "pathao_deliveries"("recipient_zone_id");

-- CreateIndex
CREATE INDEX "pathao_deliveries_recipient_area_id_idx" ON "pathao_deliveries"("recipient_area_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_recipient_city_id_fkey" FOREIGN KEY ("recipient_city_id") REFERENCES "pathao_cities"("city_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_recipient_zone_id_fkey" FOREIGN KEY ("recipient_zone_id") REFERENCES "pathao_zones"("zone_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_recipient_area_id_fkey" FOREIGN KEY ("recipient_area_id") REFERENCES "pathao_areas"("area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_city_id_fkey" FOREIGN KEY ("recipient_city_id") REFERENCES "pathao_cities"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_zone_id_fkey" FOREIGN KEY ("recipient_zone_id") REFERENCES "pathao_zones"("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_recipient_area_id_fkey" FOREIGN KEY ("recipient_area_id") REFERENCES "pathao_areas"("area_id") ON DELETE RESTRICT ON UPDATE CASCADE;
