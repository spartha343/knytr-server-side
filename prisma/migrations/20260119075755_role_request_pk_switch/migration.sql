/*
  Warnings:

  - The primary key for the `role_requests` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[userId,roleId]` on the table `role_requests` will be added. If there are existing duplicate values, this will fail.
  - Made the column `id` on table `role_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "role_requests" DROP CONSTRAINT "role_requests_pkey",
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "role_requests_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "role_requests_userId_roleId_key" ON "role_requests"("userId", "roleId");
