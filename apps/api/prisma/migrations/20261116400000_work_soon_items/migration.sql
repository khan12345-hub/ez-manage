-- AlterTable
ALTER TABLE "work_docs" ADD COLUMN     "yState" BYTEA;

-- AlterTable
ALTER TABLE "work_tasks" ADD COLUMN     "taskType" TEXT;

-- AlterTable
ALTER TABLE "work_whiteboards" ADD COLUMN     "yState" BYTEA;

-- CreateTable
CREATE TABLE "work_clips" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_templates" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_description_versions" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_description_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_clips_uid_key" ON "work_clips"("uid");

-- CreateIndex
CREATE INDEX "work_clips_workspaceId_createdAt_idx" ON "work_clips"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "work_task_templates_workspaceId_idx" ON "work_task_templates"("workspaceId");

-- CreateIndex
CREATE INDEX "work_description_versions_taskId_createdAt_idx" ON "work_description_versions"("taskId", "createdAt");

