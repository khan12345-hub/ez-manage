-- CreateTable
CREATE TABLE "work_reminders" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "taskId" INTEGER,
    "firedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_reminders_assigneeId_firedAt_remindAt_idx" ON "work_reminders"("assigneeId", "firedAt", "remindAt");

-- CreateIndex
CREATE INDEX "work_reminders_workspaceId_userId_idx" ON "work_reminders"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "work_reminders" ADD CONSTRAINT "work_reminders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reminders" ADD CONSTRAINT "work_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reminders" ADD CONSTRAINT "work_reminders_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reminders" ADD CONSTRAINT "work_reminders_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

