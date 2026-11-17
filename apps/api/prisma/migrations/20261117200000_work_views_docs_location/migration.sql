-- AlterTable
ALTER TABLE "work_docs" ADD COLUMN     "folderId" INTEGER,
ADD COLUMN     "listId" INTEGER;

-- CreateTable
CREATE TABLE "work_views" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "settings" JSONB,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_views_uid_key" ON "work_views"("uid");

-- CreateIndex
CREATE INDEX "work_views_locationType_locationId_idx" ON "work_views"("locationType", "locationId");

