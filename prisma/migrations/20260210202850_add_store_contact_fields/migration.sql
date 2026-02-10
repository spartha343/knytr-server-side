-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "messengerLink" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- CreateIndex
CREATE INDEX "Store_whatsappNumber_idx" ON "Store"("whatsappNumber");
