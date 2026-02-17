/*
  Warnings:

  - You are about to drop the column `pathaoStoreId` on the `pathao_deliveries` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `contactName` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `contactNumber` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoAreaId` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoCityId` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoStoreId` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `pathaoZoneId` on the `pathao_stores` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `pathao_stores` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branch_id]` on the table `pathao_stores` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pathao_store_id` to the `pathao_deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `area_id` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city_id` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contact_name` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contact_number` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pathao_store_id` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zone_id` to the `pathao_stores` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pathao_stores" DROP CONSTRAINT "pathao_stores_branchId_fkey";

-- DropIndex
DROP INDEX "pathao_stores_branchId_idx";

-- DropIndex
DROP INDEX "pathao_stores_branchId_key";

-- DropIndex
DROP INDEX "pathao_stores_pathaoStoreId_idx";

-- AlterTable
ALTER TABLE "pathao_deliveries" DROP COLUMN "pathaoStoreId",
ADD COLUMN     "pathao_store_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "pathao_stores" DROP COLUMN "branchId",
DROP COLUMN "contactName",
DROP COLUMN "contactNumber",
DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "lastSyncedAt",
DROP COLUMN "pathaoAreaId",
DROP COLUMN "pathaoCityId",
DROP COLUMN "pathaoStoreId",
DROP COLUMN "pathaoZoneId",
DROP COLUMN "updatedAt",
ADD COLUMN     "area_id" INTEGER NOT NULL,
ADD COLUMN     "branch_id" TEXT NOT NULL,
ADD COLUMN     "city_id" INTEGER NOT NULL,
ADD COLUMN     "contact_name" TEXT NOT NULL,
ADD COLUMN     "contact_number" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "pathao_store_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "zone_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pathao_stores_branch_id_key" ON "pathao_stores"("branch_id");

-- CreateIndex
CREATE INDEX "pathao_stores_branch_id_idx" ON "pathao_stores"("branch_id");

-- CreateIndex
CREATE INDEX "pathao_stores_pathao_store_id_idx" ON "pathao_stores"("pathao_store_id");

-- AddForeignKey
ALTER TABLE "pathao_stores" ADD CONSTRAINT "pathao_stores_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathao_deliveries" ADD CONSTRAINT "pathao_deliveries_pathao_store_id_fkey" FOREIGN KEY ("pathao_store_id") REFERENCES "pathao_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
