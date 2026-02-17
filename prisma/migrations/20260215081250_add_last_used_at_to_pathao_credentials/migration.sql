/*
  Warnings:

  - You are about to drop the column `accessToken` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `clientSecret` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExpiry` on the `pathao_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `pathao_credentials` table. All the data in the column will be lost.
  - Added the required column `client_id` to the `pathao_credentials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_secret` to the `pathao_credentials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `pathao_credentials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pathao_credentials" DROP COLUMN "accessToken",
DROP COLUMN "clientId",
DROP COLUMN "clientSecret",
DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "tokenExpiry",
DROP COLUMN "updatedAt",
ADD COLUMN     "client_id" TEXT NOT NULL,
ADD COLUMN     "client_secret" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
