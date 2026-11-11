-- CreateTable
CREATE TABLE "work_channel_bookmarks" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_channel_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_channel_bookmarks_channelId_idx" ON "work_channel_bookmarks"("channelId");

-- AddForeignKey
ALTER TABLE "work_channel_bookmarks" ADD CONSTRAINT "work_channel_bookmarks_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channel_bookmarks" ADD CONSTRAINT "work_channel_bookmarks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

