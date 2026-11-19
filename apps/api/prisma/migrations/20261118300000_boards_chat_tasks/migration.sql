-- AlterTable
ALTER TABLE "chat_channels" ADD COLUMN     "defaultBoardId" INTEGER,
ADD COLUMN     "defaultGroupId" INTEGER;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "sourceChatChannelId" INTEGER;

-- CreateTable
CREATE TABLE "chat_mention_done" (
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mention_done_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateIndex
CREATE INDEX "tasks_sourceChatChannelId_idx" ON "tasks"("sourceChatChannelId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceChatChannelId_fkey" FOREIGN KEY ("sourceChatChannelId") REFERENCES "chat_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_defaultBoardId_fkey" FOREIGN KEY ("defaultBoardId") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_defaultGroupId_fkey" FOREIGN KEY ("defaultGroupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mention_done" ADD CONSTRAINT "chat_mention_done_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

