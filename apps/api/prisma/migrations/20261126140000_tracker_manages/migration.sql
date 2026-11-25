-- Scoped teams: a manager monitors specific people (not the whole org)
CREATE TABLE "tracker_manages" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "managerId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_manages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tracker_manages_orgId_managerId_memberId_key" ON "tracker_manages"("orgId", "managerId", "memberId");
CREATE INDEX "tracker_manages_orgId_managerId_idx" ON "tracker_manages"("orgId", "managerId");
CREATE INDEX "tracker_manages_orgId_memberId_idx" ON "tracker_manages"("orgId", "memberId");
