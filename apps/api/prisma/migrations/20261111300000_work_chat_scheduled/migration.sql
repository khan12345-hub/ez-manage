-- CreateTable
CREATE TABLE "work_chat_scheduled" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "content" TEXT NOT NULL,
    "mentionIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "files" JSONB,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "messageId" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_chat_scheduled_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_chat_scheduled_status_sendAt_idx" ON "work_chat_scheduled"("status", "sendAt");

-- CreateIndex
CREATE INDEX "work_chat_scheduled_userId_status_idx" ON "work_chat_scheduled"("userId", "status");

-- AddForeignKey
ALTER TABLE "work_chat_scheduled" ADD CONSTRAINT "work_chat_scheduled_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_scheduled" ADD CONSTRAINT "work_chat_scheduled_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

