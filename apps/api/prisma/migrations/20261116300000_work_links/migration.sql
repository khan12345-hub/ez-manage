-- CreateTable
CREATE TABLE "work_links" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "work_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_links_token_key" ON "work_links"("token");

-- CreateIndex
CREATE INDEX "work_links_kind_targetId_idx" ON "work_links"("kind", "targetId");

