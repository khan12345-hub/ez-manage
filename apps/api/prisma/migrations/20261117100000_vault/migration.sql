-- CreateTable
CREATE TABLE "vault_users" (
    "userId" INTEGER NOT NULL,
    "salt" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encPrivateKey" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "vaults" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encName" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_members" (
    "vaultId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "encVaultKey" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "addedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_members_pkey" PRIMARY KEY ("vaultId","userId")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_events" (
    "id" SERIAL NOT NULL,
    "vaultId" INTEGER,
    "itemId" INTEGER,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "vault_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaults_uid_key" ON "vaults"("uid");

-- CreateIndex
CREATE INDEX "vaults_createdById_idx" ON "vaults"("createdById");

-- CreateIndex
CREATE INDEX "vault_members_userId_idx" ON "vault_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_items_uid_key" ON "vault_items"("uid");

-- CreateIndex
CREATE INDEX "vault_items_vaultId_idx" ON "vault_items"("vaultId");

-- CreateIndex
CREATE INDEX "vault_events_vaultId_createdAt_idx" ON "vault_events"("vaultId", "createdAt");

-- CreateIndex
CREATE INDEX "vault_events_userId_createdAt_idx" ON "vault_events"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vault_tokens_tokenHash_key" ON "vault_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "vault_tokens_userId_idx" ON "vault_tokens"("userId");

-- AddForeignKey
ALTER TABLE "vault_members" ADD CONSTRAINT "vault_members_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

