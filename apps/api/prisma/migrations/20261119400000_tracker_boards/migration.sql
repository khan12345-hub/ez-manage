-- EZ Tracker for Accounts & Invoices companies too: an org belongs to a product + workspace id

-- AlterTable
ALTER TABLE "tracker_orgs" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'work';

-- the old one-org-per-Work-workspace index becomes one per (product, workspace)
DROP INDEX "tracker_orgs_workspaceId_key";
CREATE UNIQUE INDEX "tracker_orgs_source_workspaceId_key" ON "tracker_orgs"("source", "workspaceId");

-- AlterTable
ALTER TABLE "tracker_sessions" ADD COLUMN "taskSource" TEXT,
ADD COLUMN "boardsTimeEntryId" INTEGER;

-- existing sessions on a task were Company Work tasks
UPDATE "tracker_sessions" SET "taskSource" = 'work' WHERE "taskId" IS NOT NULL;
