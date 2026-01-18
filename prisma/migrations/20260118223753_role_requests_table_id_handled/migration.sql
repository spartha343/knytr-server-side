/*
  Warnings:

  - The primary key for the `role_requests` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `role_requests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "role_requests" DROP CONSTRAINT "role_requests_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "role_requests_pkey" PRIMARY KEY ("userId", "roleId");
