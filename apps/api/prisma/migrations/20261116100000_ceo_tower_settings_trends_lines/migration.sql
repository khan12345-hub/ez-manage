-- CreateTable
CREATE TABLE "ceo_tower_settings" (
    "userId" INTEGER NOT NULL,
    "briefOn" BOOLEAN NOT NULL DEFAULT true,
    "briefEmail" BOOLEAN NOT NULL DEFAULT false,
    "briefHour" INTEGER NOT NULL DEFAULT 8,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "lastBriefOn" TEXT,
    "alertsOn" BOOLEAN NOT NULL DEFAULT true,
    "health" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ceo_tower_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ceo_snapshots" (
    "id" SERIAL NOT NULL,
    "companyKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "open" INTEGER NOT NULL,
    "overdue" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceo_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceo_report_lines" (
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "managerId" INTEGER NOT NULL,
    "setById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ceo_report_lines_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ceo_snapshots_companyKey_day_key" ON "ceo_snapshots"("companyKey", "day");

-- CreateIndex
CREATE INDEX "ceo_report_lines_managerId_idx" ON "ceo_report_lines"("managerId");

