-- DropForeignKey
ALTER TABLE "work_members" DROP CONSTRAINT "work_members_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "work_priorities" DROP CONSTRAINT "work_priorities_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "work_reminders" DROP CONSTRAINT "work_reminders_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "work_spaces" DROP CONSTRAINT "work_spaces_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "work_teams" DROP CONSTRAINT "work_teams_workspaceId_fkey";

-- CreateTable
CREATE TABLE "work_workspaces" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#047857',
    "avatarUrl" TEXT,
    "useCase" TEXT,
    "teamSize" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_invitations" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_notifications" (
    "id" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "taskId" INTEGER,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "eventKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_workspaces_uid_key" ON "work_workspaces"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "work_invitations_token_key" ON "work_invitations"("token");

-- CreateIndex
CREATE INDEX "work_invitations_workspaceId_status_idx" ON "work_invitations"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "work_invitations_email_idx" ON "work_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "work_notifications_eventKey_key" ON "work_notifications"("eventKey");

-- CreateIndex
CREATE INDEX "work_notifications_recipientId_createdAt_idx" ON "work_notifications"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "work_notifications_recipientId_isRead_idx" ON "work_notifications"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "work_notifications_recipientId_clearedAt_idx" ON "work_notifications"("recipientId", "clearedAt");

-- ── move existing Work data out of the Boards tables ──
-- 1. one Work workspace per Boards workspace that Work was using (same id, so every link stays valid; new uid)
INSERT INTO "work_workspaces" ("id", "uid", "name", "color", "createdById", "createdAt", "updatedAt")
SELECT w."id", substr(md5(random()::text || w."id"::text || clock_timestamp()::text), 1, 12), w."name", '#047857', w."createdById", now(), now()
FROM "workspaces" w
WHERE w."id" IN (
  SELECT "workspaceId" FROM "work_members" UNION SELECT "workspaceId" FROM "work_spaces" UNION SELECT "workspaceId" FROM "work_teams"
  UNION SELECT "workspaceId" FROM "work_reminders" UNION SELECT "workspaceId" FROM "work_priorities"
  UNION SELECT "workspaceId" FROM "invitations" WHERE "product" = 'work'
);
SELECT setval(pg_get_serial_sequence('work_workspaces', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "work_workspaces"), 1));

-- 2. Work invites
INSERT INTO "work_invitations" ("workspaceId", "email", "role", "token", "status", "invitedById", "expiresAt", "acceptedAt", "createdAt")
SELECT "workspaceId", "email", COALESCE("workRole", 'MEMBER'), "token", "status"::text, "invitedById", "expiresAt", "acceptedAt", "createdAt"
FROM "invitations" WHERE "product" = 'work';
DELETE FROM "invitations" WHERE "product" = 'work';

-- 3. Work Inbox items
INSERT INTO "work_notifications" ("id", "recipientId", "type", "title", "message", "taskId", "metadata", "isRead", "readAt", "clearedAt", "snoozedUntil", "eventKey", "createdAt")
SELECT "id", "recipientId", "type"::text, "title", "message", "entityId", "metadata", "isRead", "readAt", "clearedAt", "snoozedUntil", "eventKey", "createdAt"
FROM "Notification" WHERE "product" = 'work';
DELETE FROM "Notification" WHERE "product" = 'work';

-- AddForeignKey
ALTER TABLE "work_spaces" ADD CONSTRAINT "work_spaces_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_members" ADD CONSTRAINT "work_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reminders" ADD CONSTRAINT "work_reminders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_teams" ADD CONSTRAINT "work_teams_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_priorities" ADD CONSTRAINT "work_priorities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_workspaces" ADD CONSTRAINT "work_workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_invitations" ADD CONSTRAINT "work_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_invitations" ADD CONSTRAINT "work_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

