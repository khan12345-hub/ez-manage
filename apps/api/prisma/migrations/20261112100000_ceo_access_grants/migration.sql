-- CreateTable
CREATE TABLE "ceo_access_grants" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceo_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ceo_access_grants_userId_idx" ON "ceo_access_grants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ceo_access_grants_ownerId_userId_key" ON "ceo_access_grants"("ownerId", "userId");

