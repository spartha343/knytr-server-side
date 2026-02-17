/*
  Warnings:

  - A unique constraint covering the columns `[branch_id]` on the table `pathao_credentials` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branch_id` to the `pathao_credentials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pathao_credentials" ADD COLUMN     "branch_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pathao_credentials_branch_id_key" ON "pathao_credentials"("branch_id");

-- AddForeignKey
ALTER TABLE "pathao_credentials" ADD CONSTRAINT "pathao_credentials_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
