-- EZ Vault: company vaults, vault admins, outside-sharing setting, passwords-to-change after removals, admin recovery

ALTER TABLE "vault_users" ADD COLUMN "recoveryPriv" TEXT, ADD COLUMN "recoveryKey" TEXT, ADD COLUMN "recoveryVersion" INTEGER;

ALTER TABLE "vaults" ADD COLUMN "companySource" TEXT, ADD COLUMN "companyWorkspaceId" INTEGER, ADD COLUMN "needsRekey" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "vaults_companySource_companyWorkspaceId_idx" ON "vaults"("companySource", "companyWorkspaceId");

CREATE TABLE "vault_companies" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "allowOutsideSharing" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vault_companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vault_companies_source_workspaceId_key" ON "vault_companies"("source", "workspaceId");

CREATE TABLE "vault_admins" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "grantedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vault_admins_source_workspaceId_userId_key" ON "vault_admins"("source", "workspaceId", "userId");
CREATE INDEX "vault_admins_userId_idx" ON "vault_admins"("userId");

CREATE TABLE "vault_rotations" (
    "id" SERIAL NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "removedUserId" INTEGER NOT NULL,
    "removedById" INTEGER,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" JSONB NOT NULL,
    "resolvedItemIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    CONSTRAINT "vault_rotations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vault_rotations_vaultId_removedAt_idx" ON "vault_rotations"("vaultId", "removedAt");

CREATE TABLE "vault_recovery_keys" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encPrivateKey" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_recovery_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vault_recovery_keys_version_key" ON "vault_recovery_keys"("version");

CREATE TABLE "vault_recovery_requests" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ephemeralPublicKey" TEXT NOT NULL,
    "wrappedKey" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_recovery_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vault_recovery_requests_userId_createdAt_idx" ON "vault_recovery_requests"("userId", "createdAt");
CREATE INDEX "vault_recovery_requests_status_idx" ON "vault_recovery_requests"("status");
