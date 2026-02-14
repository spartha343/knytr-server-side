/*
  Warnings:

  - You are about to drop the column `deliveryDivision` on the `orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "deliveryDivision",
ADD COLUMN     "policeStation" TEXT;
