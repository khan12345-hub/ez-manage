-- EZ Tracker has its own people per company (role member | admin, tracking on/off) + install reminders

-- CreateTable
CREATE TABLE "tracker_members" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "tracking" BOOLEAN NOT NULL DEFAULT true,
    "addedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_reminders" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "sentById" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracker_members_orgId_userId_key" ON "tracker_members"("orgId", "userId");
CREATE INDEX "tracker_members_userId_idx" ON "tracker_members"("userId");
CREATE INDEX "tracker_reminders_orgId_userId_sentAt_idx" ON "tracker_reminders"("orgId", "userId", "sentAt");

-- AddForeignKey
ALTER TABLE "tracker_members" ADD CONSTRAINT "tracker_members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_reminders" ADD CONSTRAINT "tracker_reminders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nothing breaks for people already using it: everyone who paired a computer, agreed or tracked
-- in a company becomes a member there (admins are only added explicitly afterwards).
INSERT INTO "tracker_members" ("orgId", "userId", "role", "tracking")
SELECT DISTINCT x."orgId", x."userId", 'member', true FROM (
  SELECT "orgId", "userId" FROM "tracker_devices"
  UNION SELECT "orgId", "userId" FROM "tracker_consents"
  UNION SELECT "orgId", "userId" FROM "tracker_sessions"
) x
ON CONFLICT ("orgId", "userId") DO NOTHING;

-- people that the old "who is tracked" setting excluded keep tracking off
UPDATE "tracker_members" m SET "tracking" = false
FROM "tracker_orgs" o
WHERE o."id" = m."orgId"
  AND COALESCE((o."settings"->>'trackAll')::boolean, true) = false
  AND NOT (COALESCE(o."settings"->'trackedUserIds', '[]'::jsonb) @> to_jsonb(m."userId"));
