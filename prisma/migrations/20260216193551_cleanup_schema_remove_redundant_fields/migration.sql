/*
  Warnings:

  - You are about to drop the column `deliveryArea` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryDistrict` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `editNotes` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `editedAt` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `isEditedByVendor` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `isVoiceConfirmed` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `policeStation` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `voiceConfirmedAt` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `voiceConfirmedBy` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `otp_number` on the `pathao_stores` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "deliveryArea",
DROP COLUMN "deliveryDistrict",
DROP COLUMN "editNotes",
DROP COLUMN "editedAt",
DROP COLUMN "isEditedByVendor",
DROP COLUMN "isVoiceConfirmed",
DROP COLUMN "policeStation",
DROP COLUMN "voiceConfirmedAt",
DROP COLUMN "voiceConfirmedBy",
ADD COLUMN     "secondaryPhone" TEXT,
ADD COLUMN     "specialInstructions" TEXT;

-- AlterTable
ALTER TABLE "pathao_stores" DROP COLUMN "otp_number";
