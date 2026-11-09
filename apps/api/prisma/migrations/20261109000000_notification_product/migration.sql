-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'boards';

-- CreateIndex
CREATE INDEX "Notification_recipientId_product_isRead_idx" ON "Notification"("recipientId", "product", "isRead");


-- Backfill: notifications created by Work carry metadata.product = "work"
UPDATE "Notification" SET "product" = 'work' WHERE "metadata"->>'product' = 'work';
