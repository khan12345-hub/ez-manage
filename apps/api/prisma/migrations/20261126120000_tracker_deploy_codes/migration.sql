-- Zero-touch silent deployment: long-lived, revocable per-person deploy codes
CREATE TABLE "tracker_deploy_codes" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_deploy_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tracker_deploy_codes_codeHash_key" ON "tracker_deploy_codes"("codeHash");
CREATE INDEX "tracker_deploy_codes_userId_idx" ON "tracker_deploy_codes"("userId");
CREATE INDEX "tracker_deploy_codes_orgId_idx" ON "tracker_deploy_codes"("orgId");

ALTER TABLE "tracker_deploy_codes" ADD CONSTRAINT "tracker_deploy_codes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
