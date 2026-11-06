-- Work task detail: time estimate, tags, checklists, task links (dependencies),
-- time tracking, assigned comments, activity history. Additive only.

-- CreateEnum
CREATE TYPE "WorkLinkType" AS ENUM ('WAITING_ON', 'LINKED');

-- AlterTable
ALTER TABLE "work_comments" ADD COLUMN     "assigneeId" INTEGER,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_tasks" ADD COLUMN     "timeEstimate" INTEGER;

-- CreateTable
CREATE TABLE "work_tags" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_tags" (
    "taskId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "work_task_tags_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "work_checklists" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_checklist_items" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" INTEGER,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_links" (
    "id" SERIAL NOT NULL,
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,
    "type" "WorkLinkType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_time_entries" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "note" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_activities" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromValue" JSONB,
    "toValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_tags_spaceId_name_key" ON "work_tags"("spaceId", "name");

-- CreateIndex
CREATE INDEX "work_task_tags_tagId_idx" ON "work_task_tags"("tagId");

-- CreateIndex
CREATE INDEX "work_checklists_taskId_idx" ON "work_checklists"("taskId");

-- CreateIndex
CREATE INDEX "work_checklist_items_checklistId_idx" ON "work_checklist_items"("checklistId");

-- CreateIndex
CREATE INDEX "work_task_links_toId_idx" ON "work_task_links"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "work_task_links_fromId_toId_type_key" ON "work_task_links"("fromId", "toId", "type");

-- CreateIndex
CREATE INDEX "work_time_entries_taskId_idx" ON "work_time_entries"("taskId");

-- CreateIndex
CREATE INDEX "work_time_entries_userId_endedAt_idx" ON "work_time_entries"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "work_activities_taskId_createdAt_idx" ON "work_activities"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "work_comments_assigneeId_resolvedAt_idx" ON "work_comments"("assigneeId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "work_comments" ADD CONSTRAINT "work_comments_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tags" ADD CONSTRAINT "work_tags_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_tags" ADD CONSTRAINT "work_task_tags_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_tags" ADD CONSTRAINT "work_task_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "work_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_checklists" ADD CONSTRAINT "work_checklists_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_checklist_items" ADD CONSTRAINT "work_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "work_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_checklist_items" ADD CONSTRAINT "work_checklist_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_links" ADD CONSTRAINT "work_task_links_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_links" ADD CONSTRAINT "work_task_links_toId_fkey" FOREIGN KEY ("toId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one running timer per user.
CREATE UNIQUE INDEX "work_time_entries_one_running_per_user" ON "work_time_entries"("userId") WHERE "endedAt" IS NULL;
ALTER TABLE "work_task_links" ADD CONSTRAINT "work_task_links_not_self" CHECK ("fromId" <> "toId");
