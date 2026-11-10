-- CreateTable
CREATE TABLE "work_automations" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "folderId" INTEGER,
    "listId" INTEGER,
    "name" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_automation_runs" (
    "id" SERIAL NOT NULL,
    "automationId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_automations_spaceId_enabled_idx" ON "work_automations"("spaceId", "enabled");

-- CreateIndex
CREATE INDEX "work_automation_runs_automationId_createdAt_idx" ON "work_automation_runs"("automationId", "createdAt");

-- AddForeignKey
ALTER TABLE "work_automations" ADD CONSTRAINT "work_automations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_automations" ADD CONSTRAINT "work_automations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_automation_runs" ADD CONSTRAINT "work_automation_runs_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "work_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

