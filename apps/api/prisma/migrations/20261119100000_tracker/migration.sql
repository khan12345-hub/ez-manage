-- CreateTable
CREATE TABLE "tracker_orgs" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_consents" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "tracker_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_pair_codes" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_pair_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_devices" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT,
    "appVersion" TEXT,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_sessions" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "clientId" TEXT,
    "taskId" INTEGER,
    "projectLabel" TEXT,
    "note" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "lastBeatAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'desktop',
    "workTimeEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_slots" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL,
    "keyboard" INTEGER NOT NULL DEFAULT 0,
    "mouse" INTEGER NOT NULL DEFAULT 0,
    "activityPct" INTEGER NOT NULL DEFAULT 0,
    "idleDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_shots" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileId" INTEGER,
    "url" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "screen" INTEGER NOT NULL DEFAULT 0,
    "blurred" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracker_shots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_app_usage" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "orgId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "app" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "seconds" INTEGER NOT NULL,

    CONSTRAINT "tracker_app_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracker_orgs_workspaceId_key" ON "tracker_orgs"("workspaceId");

-- CreateIndex
CREATE INDEX "tracker_consents_userId_idx" ON "tracker_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_consents_orgId_userId_version_key" ON "tracker_consents"("orgId", "userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_pair_codes_codeHash_key" ON "tracker_pair_codes"("codeHash");

-- CreateIndex
CREATE INDEX "tracker_pair_codes_userId_idx" ON "tracker_pair_codes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_devices_tokenHash_key" ON "tracker_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "tracker_devices_userId_idx" ON "tracker_devices"("userId");

-- CreateIndex
CREATE INDEX "tracker_devices_orgId_idx" ON "tracker_devices"("orgId");

-- CreateIndex
CREATE INDEX "tracker_sessions_orgId_userId_startedAt_idx" ON "tracker_sessions"("orgId", "userId", "startedAt");

-- CreateIndex
CREATE INDEX "tracker_sessions_orgId_endedAt_idx" ON "tracker_sessions"("orgId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_sessions_userId_clientId_key" ON "tracker_sessions"("userId", "clientId");

-- CreateIndex
CREATE INDEX "tracker_slots_orgId_userId_start_idx" ON "tracker_slots"("orgId", "userId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_slots_userId_clientId_key" ON "tracker_slots"("userId", "clientId");

-- CreateIndex
CREATE INDEX "tracker_shots_orgId_userId_takenAt_idx" ON "tracker_shots"("orgId", "userId", "takenAt");

-- CreateIndex
CREATE INDEX "tracker_shots_takenAt_idx" ON "tracker_shots"("takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_shots_userId_clientId_key" ON "tracker_shots"("userId", "clientId");

-- CreateIndex
CREATE INDEX "tracker_app_usage_orgId_userId_idx" ON "tracker_app_usage"("orgId", "userId");

-- CreateIndex
CREATE INDEX "tracker_app_usage_slotId_idx" ON "tracker_app_usage"("slotId");

-- AddForeignKey
ALTER TABLE "tracker_consents" ADD CONSTRAINT "tracker_consents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_pair_codes" ADD CONSTRAINT "tracker_pair_codes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_sessions" ADD CONSTRAINT "tracker_sessions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "tracker_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_slots" ADD CONSTRAINT "tracker_slots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tracker_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_shots" ADD CONSTRAINT "tracker_shots_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "tracker_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_app_usage" ADD CONSTRAINT "tracker_app_usage_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "tracker_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
