-- Emergency / full access: a person grants a trusted user access to their own vault.
CREATE TABLE "vault_emergency_grants" (
  "id" SERIAL NOT NULL,
  "granterId" INTEGER NOT NULL,
  "granteeId" INTEGER NOT NULL,
  "vaultId" INTEGER NOT NULL,
  "role" VARCHAR(20) NOT NULL DEFAULT 'viewer',
  "mode" VARCHAR(20) NOT NULL DEFAULT 'approval',
  "waitDays" INTEGER NOT NULL DEFAULT 3,
  "status" VARCHAR(20) NOT NULL DEFAULT 'offered',
  "encVaultKey" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "requestedAt" TIMESTAMP(3),
  "activatesAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vault_emergency_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vault_emergency_grants_granterId_granteeId_key" ON "vault_emergency_grants" ("granterId", "granteeId");
CREATE INDEX "vault_emergency_grants_granteeId_idx" ON "vault_emergency_grants" ("granteeId");
CREATE INDEX "vault_emergency_grants_status_idx" ON "vault_emergency_grants" ("status");
