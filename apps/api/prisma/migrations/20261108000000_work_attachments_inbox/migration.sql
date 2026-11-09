-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "work_attachments" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "commentId" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'task',
    "uploadedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_web_links" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_web_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_attachments_taskId_createdAt_idx" ON "work_attachments"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "work_attachments_commentId_idx" ON "work_attachments"("commentId");

-- CreateIndex
CREATE INDEX "work_web_links_taskId_idx" ON "work_web_links"("taskId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_clearedAt_idx" ON "Notification"("recipientId", "clearedAt");

-- AddForeignKey
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "work_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_web_links" ADD CONSTRAINT "work_web_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_web_links" ADD CONSTRAINT "work_web_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

