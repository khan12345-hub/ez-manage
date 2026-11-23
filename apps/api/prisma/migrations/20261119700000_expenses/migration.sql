-- Reimbursements / Expenses (inside Accounts & Invoices). Written by hand: only these four tables.
CREATE TABLE "expense_categories" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "monthlyBudget" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_categories_workspaceId_idx" ON "expense_categories"("workspaceId");

CREATE TABLE "expense_claims" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "claimantId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "categoryId" INTEGER,
    "description" VARCHAR(2000),
    "incurredOn" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "managerId" INTEGER,
    "managerAt" TIMESTAMP(3),
    "financeId" INTEGER,
    "financeAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedById" INTEGER,
    "rejectedReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_claims_workspaceId_status_idx" ON "expense_claims"("workspaceId", "status");
CREATE INDEX "expense_claims_claimantId_idx" ON "expense_claims"("claimantId");

CREATE TABLE "expense_receipts" (
    "id" SERIAL NOT NULL,
    "claimId" INTEGER NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "fileUrl" VARCHAR(1000) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_receipts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_receipts_claimId_idx" ON "expense_receipts"("claimId");
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "expense_events" (
    "id" SERIAL NOT NULL,
    "claimId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" VARCHAR(20) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_events_claimId_idx" ON "expense_events"("claimId");
ALTER TABLE "expense_events" ADD CONSTRAINT "expense_events_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
