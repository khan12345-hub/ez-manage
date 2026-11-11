-- CreateTable
CREATE TABLE "work_channel_views" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listId" INTEGER,
    "content" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_channel_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_channel_views_channelId_idx" ON "work_channel_views"("channelId");

-- AddForeignKey
ALTER TABLE "work_channel_views" ADD CONSTRAINT "work_channel_views_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channel_views" ADD CONSTRAINT "work_channel_views_listId_fkey" FOREIGN KEY ("listId") REFERENCES "work_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channel_views" ADD CONSTRAINT "work_channel_views_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

