-- CreateTable
CREATE TABLE "work_comment_reactions" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_notification_prefs" (
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "inbox" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "browser" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_notification_prefs_pkey" PRIMARY KEY ("userId","kind")
);

-- CreateIndex
CREATE INDEX "work_comment_reactions_commentId_idx" ON "work_comment_reactions"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "work_comment_reactions_commentId_userId_emoji_key" ON "work_comment_reactions"("commentId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "work_comment_reactions" ADD CONSTRAINT "work_comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "work_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_reactions" ADD CONSTRAINT "work_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notification_prefs" ADD CONSTRAINT "work_notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

