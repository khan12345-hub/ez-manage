-- Access Center: Access Managers (people who manage access in specific companies)
CREATE TABLE "access_manager_scopes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "product" VARCHAR(20) NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "source" VARCHAR(10),
    "mayGrantAdmin" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_manager_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "access_manager_scopes_userId_product_workspaceId_key" ON "access_manager_scopes"("userId", "product", "workspaceId");
CREATE INDEX "access_manager_scopes_userId_idx" ON "access_manager_scopes"("userId");
