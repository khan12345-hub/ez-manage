-- AlterTable
ALTER TABLE "work_web_links" ADD COLUMN     "description" TEXT,
ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "previewAt" TIMESTAMP(3),
ADD COLUMN     "siteName" TEXT;

