-- Work (ClickUp-style product), core: Space -> Folder -> List -> Task, statuses,
-- assignees, comments. New tables only; nothing existing is changed.

-- CreateEnum
CREATE TYPE "WorkPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "work_spaces" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#047857',
    "icon" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "archivedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_space_members" (
    "spaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_space_members_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateTable
CREATE TABLE "work_folders" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "archivedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_lists" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "folderId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "archivedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_statuses" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER,
    "folderId" INTEGER,
    "listId" INTEGER,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL DEFAULT 'ACTIVE',
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tasks" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "listId" INTEGER NOT NULL,
    "statusId" INTEGER,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" "WorkPriority",
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_assignees" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_assignees_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "work_comments" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_spaces_uid_key" ON "work_spaces"("uid");

-- CreateIndex
CREATE INDEX "work_spaces_workspaceId_idx" ON "work_spaces"("workspaceId");

-- CreateIndex
CREATE INDEX "work_space_members_userId_idx" ON "work_space_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "work_folders_uid_key" ON "work_folders"("uid");

-- CreateIndex
CREATE INDEX "work_folders_spaceId_idx" ON "work_folders"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "work_lists_uid_key" ON "work_lists"("uid");

-- CreateIndex
CREATE INDEX "work_lists_spaceId_idx" ON "work_lists"("spaceId");

-- CreateIndex
CREATE INDEX "work_lists_folderId_idx" ON "work_lists"("folderId");

-- CreateIndex
CREATE INDEX "work_statuses_spaceId_idx" ON "work_statuses"("spaceId");

-- CreateIndex
CREATE INDEX "work_statuses_folderId_idx" ON "work_statuses"("folderId");

-- CreateIndex
CREATE INDEX "work_statuses_listId_idx" ON "work_statuses"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "work_tasks_uid_key" ON "work_tasks"("uid");

-- CreateIndex
CREATE INDEX "work_tasks_listId_order_idx" ON "work_tasks"("listId", "order");

-- CreateIndex
CREATE INDEX "work_tasks_statusId_idx" ON "work_tasks"("statusId");

-- CreateIndex
CREATE INDEX "work_tasks_parentId_idx" ON "work_tasks"("parentId");

-- CreateIndex
CREATE INDEX "work_tasks_dueDate_idx" ON "work_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "work_task_assignees_userId_idx" ON "work_task_assignees"("userId");

-- CreateIndex
CREATE INDEX "work_comments_taskId_createdAt_idx" ON "work_comments"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "work_spaces" ADD CONSTRAINT "work_spaces_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_spaces" ADD CONSTRAINT "work_spaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_space_members" ADD CONSTRAINT "work_space_members_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_space_members" ADD CONSTRAINT "work_space_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_folders" ADD CONSTRAINT "work_folders_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_folders" ADD CONSTRAINT "work_folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_lists" ADD CONSTRAINT "work_lists_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_lists" ADD CONSTRAINT "work_lists_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "work_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_lists" ADD CONSTRAINT "work_lists_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_statuses" ADD CONSTRAINT "work_statuses_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_statuses" ADD CONSTRAINT "work_statuses_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "work_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_statuses" ADD CONSTRAINT "work_statuses_listId_fkey" FOREIGN KEY ("listId") REFERENCES "work_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_listId_fkey" FOREIGN KEY ("listId") REFERENCES "work_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "work_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_assignees" ADD CONSTRAINT "work_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_assignees" ADD CONSTRAINT "work_task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comments" ADD CONSTRAINT "work_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comments" ADD CONSTRAINT "work_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comments" ADD CONSTRAINT "work_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "work_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A status belongs to exactly one of space / folder / list.
ALTER TABLE "work_statuses" ADD CONSTRAINT "work_statuses_one_owner" CHECK (num_nonnulls("spaceId", "folderId", "listId") = 1);
