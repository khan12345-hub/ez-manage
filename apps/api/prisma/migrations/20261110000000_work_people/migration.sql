-- AlterTable
ALTER TABLE "work_members" ADD COLUMN     "managerId" INTEGER,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "work_teams" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#047857',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_team_members" (
    "teamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "work_team_members_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "work_priorities" (
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_priorities_pkey" PRIMARY KEY ("userId","taskId")
);

-- CreateIndex
CREATE INDEX "work_teams_workspaceId_idx" ON "work_teams"("workspaceId");

-- CreateIndex
CREATE INDEX "work_team_members_userId_idx" ON "work_team_members"("userId");

-- CreateIndex
CREATE INDEX "work_priorities_workspaceId_userId_idx" ON "work_priorities"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "work_teams" ADD CONSTRAINT "work_teams_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_team_members" ADD CONSTRAINT "work_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "work_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_team_members" ADD CONSTRAINT "work_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_priorities" ADD CONSTRAINT "work_priorities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_priorities" ADD CONSTRAINT "work_priorities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_priorities" ADD CONSTRAINT "work_priorities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

