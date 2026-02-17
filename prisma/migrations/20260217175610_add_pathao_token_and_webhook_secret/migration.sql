-- AlterTable
ALTER TABLE "pathao_credentials" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "token_expiry" TIMESTAMP(3),
ADD COLUMN     "webhook_secret" TEXT;
