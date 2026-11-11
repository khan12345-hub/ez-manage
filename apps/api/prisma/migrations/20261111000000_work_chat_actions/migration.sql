-- AlterTable
ALTER TABLE "work_chat_messages" ADD COLUMN     "assignedById" INTEGER,
ADD COLUMN     "forwarded" JSONB,
ADD COLUMN     "taskId" INTEGER;

-- AlterTable
ALTER TABLE "work_reminders" ADD COLUMN     "url" TEXT;

-- AddForeignKey
ALTER TABLE "work_chat_messages" ADD CONSTRAINT "work_chat_messages_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_messages" ADD CONSTRAINT "work_chat_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

