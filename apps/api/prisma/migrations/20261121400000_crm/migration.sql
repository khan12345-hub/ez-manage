-- CreateTable
CREATE TABLE "crm_workspaces" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_members" (
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_members_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "crm_companies" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "ownerId" INTEGER,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "createdById" INTEGER NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "companyId" INTEGER,
    "ownerId" INTEGER,
    "lifecycle" TEXT NOT NULL DEFAULT 'lead',
    "leadStatus" TEXT,
    "source" TEXT,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "createdById" INTEGER NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_stages" (
    "id" SERIAL NOT NULL,
    "pipelineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 10,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deals" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "pipelineId" INTEGER NOT NULL,
    "stageId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT,
    "closeDate" TIMESTAMP(3),
    "ownerId" INTEGER,
    "priority" TEXT,
    "companyId" INTEGER,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "createdById" INTEGER NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deal_contacts" (
    "dealId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,

    CONSTRAINT "crm_deal_contacts_pkey" PRIMARY KEY ("dealId","contactId")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "outcome" TEXT,
    "durationMin" INTEGER,
    "ownerId" INTEGER NOT NULL,
    "assigneeId" INTEGER,
    "contactId" INTEGER,
    "companyId" INTEGER,
    "dealId" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_properties" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "object" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "options" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_views" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "object" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdById" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_workspaces_uid_key" ON "crm_workspaces"("uid");

-- CreateIndex
CREATE INDEX "crm_members_userId_idx" ON "crm_members"("userId");

-- CreateIndex
CREATE INDEX "crm_companies_workspaceId_ownerId_idx" ON "crm_companies"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "crm_companies_workspaceId_name_idx" ON "crm_companies"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "crm_contacts_workspaceId_ownerId_idx" ON "crm_contacts"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "crm_contacts_workspaceId_lifecycle_idx" ON "crm_contacts"("workspaceId", "lifecycle");

-- CreateIndex
CREATE INDEX "crm_contacts_workspaceId_email_idx" ON "crm_contacts"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "crm_contacts_companyId_idx" ON "crm_contacts"("companyId");

-- CreateIndex
CREATE INDEX "crm_pipelines_workspaceId_idx" ON "crm_pipelines"("workspaceId");

-- CreateIndex
CREATE INDEX "crm_stages_pipelineId_idx" ON "crm_stages"("pipelineId");

-- CreateIndex
CREATE INDEX "crm_deals_workspaceId_stageId_idx" ON "crm_deals"("workspaceId", "stageId");

-- CreateIndex
CREATE INDEX "crm_deals_workspaceId_ownerId_idx" ON "crm_deals"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "crm_deals_pipelineId_idx" ON "crm_deals"("pipelineId");

-- CreateIndex
CREATE INDEX "crm_deals_companyId_idx" ON "crm_deals"("companyId");

-- CreateIndex
CREATE INDEX "crm_deal_contacts_contactId_idx" ON "crm_deal_contacts"("contactId");

-- CreateIndex
CREATE INDEX "crm_activities_workspaceId_kind_doneAt_idx" ON "crm_activities"("workspaceId", "kind", "doneAt");

-- CreateIndex
CREATE INDEX "crm_activities_workspaceId_assigneeId_doneAt_idx" ON "crm_activities"("workspaceId", "assigneeId", "doneAt");

-- CreateIndex
CREATE INDEX "crm_activities_contactId_idx" ON "crm_activities"("contactId");

-- CreateIndex
CREATE INDEX "crm_activities_companyId_idx" ON "crm_activities"("companyId");

-- CreateIndex
CREATE INDEX "crm_activities_dealId_idx" ON "crm_activities"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_properties_workspaceId_object_key_key" ON "crm_properties"("workspaceId", "object", "key");

-- CreateIndex
CREATE INDEX "crm_views_workspaceId_object_idx" ON "crm_views"("workspaceId", "object");

-- AddForeignKey
ALTER TABLE "crm_members" ADD CONSTRAINT "crm_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_members" ADD CONSTRAINT "crm_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "crm_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_contacts" ADD CONSTRAINT "crm_deal_contacts_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_contacts" ADD CONSTRAINT "crm_deal_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_views" ADD CONSTRAINT "crm_views_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

