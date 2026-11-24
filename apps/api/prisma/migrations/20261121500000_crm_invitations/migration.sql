-- Pending invites into a CRM workspace for people who don't have an EZ Manage account yet.
CREATE TABLE "crm_invitations" (
  "id" SERIAL NOT NULL,
  "workspaceId" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "invitedById" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_invitations_token_key" ON "crm_invitations" ("token");
CREATE INDEX "crm_invitations_workspaceId_status_idx" ON "crm_invitations" ("workspaceId", "status");
CREATE INDEX "crm_invitations_email_idx" ON "crm_invitations" ("email");

ALTER TABLE "crm_invitations"
  ADD CONSTRAINT "crm_invitations_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
