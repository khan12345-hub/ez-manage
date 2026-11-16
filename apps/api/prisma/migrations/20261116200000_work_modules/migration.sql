-- AlterTable
ALTER TABLE "work_tasks" ADD COLUMN     "points" INTEGER,
ADD COLUMN     "recurredFromId" INTEGER,
ADD COLUMN     "recurrence" JSONB,
ADD COLUMN     "sprintId" INTEGER;

-- CreateTable
CREATE TABLE "work_sprints" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "spaceId" INTEGER,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_goals" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#047857',
    "ownerId" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_goal_targets" (
    "id" SERIAL NOT NULL,
    "goalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startVal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetVal" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "listId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_goal_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_docs" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "spaceId" INTEGER,
    "parentId" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_forms" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "listId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_whiteboards" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_sprints_workspaceId_status_idx" ON "work_sprints"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "work_goals_workspaceId_idx" ON "work_goals"("workspaceId");

-- CreateIndex
CREATE INDEX "work_goal_targets_goalId_idx" ON "work_goal_targets"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "work_docs_uid_key" ON "work_docs"("uid");

-- CreateIndex
CREATE INDEX "work_docs_workspaceId_spaceId_idx" ON "work_docs"("workspaceId", "spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "work_forms_uid_key" ON "work_forms"("uid");

-- CreateIndex
CREATE INDEX "work_forms_workspaceId_idx" ON "work_forms"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "work_whiteboards_uid_key" ON "work_whiteboards"("uid");

-- CreateIndex
CREATE INDEX "work_whiteboards_workspaceId_idx" ON "work_whiteboards"("workspaceId");

