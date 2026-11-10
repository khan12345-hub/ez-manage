-- AlterTable
ALTER TABLE "work_channel_members" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "notify" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "permission" TEXT NOT NULL DEFAULT 'edit';


-- channel creators / owners keep full edit
UPDATE "work_channel_members" SET "permission" = 'full' WHERE "role" = 'owner';
