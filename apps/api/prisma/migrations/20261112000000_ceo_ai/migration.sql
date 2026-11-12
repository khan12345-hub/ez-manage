-- CreateTable
CREATE TABLE "ceo_ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ceo_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceo_ai_actions" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ceo_ai_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ceo_ai_conversations_userId_updatedAt_idx" ON "ceo_ai_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ceo_ai_actions_userId_status_idx" ON "ceo_ai_actions"("userId", "status");

-- AddForeignKey
ALTER TABLE "ceo_ai_actions" ADD CONSTRAINT "ceo_ai_actions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ceo_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

