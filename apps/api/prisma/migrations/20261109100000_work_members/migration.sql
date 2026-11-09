-- CreateEnum
CREATE TYPE "WorkRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'boards',
ADD COLUMN     "workRole" "WorkRole";

-- CreateTable
CREATE TABLE "work_members" (
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "WorkRole" NOT NULL DEFAULT 'MEMBER',
    "invitedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_members_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateIndex
CREATE INDEX "work_members_userId_idx" ON "work_members"("userId");

-- AddForeignKey
ALTER TABLE "work_members" ADD CONSTRAINT "work_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_members" ADD CONSTRAINT "work_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_members" ADD CONSTRAINT "work_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Bootstrap: each workspace's owner owns its Work area (nobody else gets Work access automatically)
INSERT INTO "work_members" ("workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT wm."workspaceId", wm."userId", 'OWNER', now(), now()
FROM "workspace_members" wm
WHERE wm."role" = 'OWNER' AND wm."deleted_at" IS NULL
ON CONFLICT DO NOTHING;
