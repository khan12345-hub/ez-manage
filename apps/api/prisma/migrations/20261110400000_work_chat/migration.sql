-- CreateTable
CREATE TABLE "work_channels" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'channel',
    "name" TEXT,
    "description" TEXT,
    "topic" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "locationType" TEXT,
    "locationId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_channel_members" (
    "channelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "lastReadAt" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_channel_members_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "work_chat_messages" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'message',
    "title" TEXT,
    "postType" TEXT,
    "content" TEXT NOT NULL,
    "mentionIds" INTEGER[],
    "files" JSONB,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "alsoInChannel" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_chat_reactions" (
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chat_reactions_pkey" PRIMARY KEY ("messageId","userId","emoji")
);

-- CreateTable
CREATE TABLE "work_chat_drafts" (
    "userId" INTEGER NOT NULL,
    "channelId" INTEGER NOT NULL,
    "parentId" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_chat_drafts_pkey" PRIMARY KEY ("userId","channelId","parentId")
);

-- CreateTable
CREATE TABLE "work_chat_saved" (
    "userId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chat_saved_pkey" PRIMARY KEY ("userId","messageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_channels_uid_key" ON "work_channels"("uid");

-- CreateIndex
CREATE INDEX "work_channels_workspaceId_kind_idx" ON "work_channels"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "work_channel_members_userId_idx" ON "work_channel_members"("userId");

-- CreateIndex
CREATE INDEX "work_chat_messages_channelId_createdAt_idx" ON "work_chat_messages"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "work_chat_messages_parentId_createdAt_idx" ON "work_chat_messages"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "work_chat_messages_userId_createdAt_idx" ON "work_chat_messages"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "work_channels" ADD CONSTRAINT "work_channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channels" ADD CONSTRAINT "work_channels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channel_members" ADD CONSTRAINT "work_channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_channel_members" ADD CONSTRAINT "work_channel_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_messages" ADD CONSTRAINT "work_chat_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_messages" ADD CONSTRAINT "work_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_messages" ADD CONSTRAINT "work_chat_messages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "work_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_reactions" ADD CONSTRAINT "work_chat_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "work_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_reactions" ADD CONSTRAINT "work_chat_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_drafts" ADD CONSTRAINT "work_chat_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_drafts" ADD CONSTRAINT "work_chat_drafts_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "work_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_saved" ADD CONSTRAINT "work_chat_saved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_saved" ADD CONSTRAINT "work_chat_saved_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "work_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

