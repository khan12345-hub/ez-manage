-- AlterTable
ALTER TABLE "work_channels" ADD COLUMN     "defaultListId" INTEGER;

-- AlterTable
ALTER TABLE "work_chat_messages" ADD COLUMN     "mentionDoneIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "taskIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "work_tasks" ADD COLUMN     "sourceChannelId" INTEGER;

-- CreateIndex
CREATE INDEX "work_tasks_sourceChannelId_idx" ON "work_tasks"("sourceChannelId");

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_sourceChannelId_fkey" FOREIGN KEY ("sourceChannelId") REFERENCES "work_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channels" ADD CONSTRAINT "work_channels_defaultListId_fkey" FOREIGN KEY ("defaultListId") REFERENCES "work_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

