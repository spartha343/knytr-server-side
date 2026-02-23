-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_brandId_fkey";

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "brandId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
