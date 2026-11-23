-- Access Center: per-user product switch + access history (written by hand: only these two tables)
CREATE TABLE "user_product_access" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "product" VARCHAR(20) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_product_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_product_access_userId_product_key" ON "user_product_access"("userId", "product");

CREATE TABLE "access_audit" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "targetUserId" INTEGER,
    "targetEmail" VARCHAR(255),
    "product" VARCHAR(20) NOT NULL,
    "workspaceId" INTEGER,
    "workspaceName" VARCHAR(255),
    "action" VARCHAR(30) NOT NULL,
    "fromRole" VARCHAR(30),
    "toRole" VARCHAR(30),
    "via" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "access_audit_targetUserId_createdAt_idx" ON "access_audit"("targetUserId", "createdAt");
CREATE INDEX "access_audit_createdAt_idx" ON "access_audit"("createdAt");
