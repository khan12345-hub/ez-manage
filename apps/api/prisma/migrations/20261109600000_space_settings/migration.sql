-- AlterTable
ALTER TABLE "work_spaces" ADD COLUMN     "defaultPermission" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "description" TEXT;

