-- Reimbursement form builder: branding + custom fields + shareable link, and custom values on claims.
ALTER TABLE "expense_claims" ADD COLUMN "paidOn" DATE;
ALTER TABLE "expense_claims" ADD COLUMN "custom" JSONB;

CREATE TABLE "expense_forms" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL DEFAULT 'Reimbursements',
    "description" VARCHAR(1000),
    "logoUrl" VARCHAR(1000),
    "bannerUrl" VARCHAR(1000),
    "shareToken" VARCHAR(40) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expense_forms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_forms_workspaceId_key" ON "expense_forms"("workspaceId");
CREATE UNIQUE INDEX "expense_forms_shareToken_key" ON "expense_forms"("shareToken");

CREATE TABLE "expense_form_fields" (
    "id" SERIAL NOT NULL,
    "formId" INTEGER NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maps" VARCHAR(20),
    CONSTRAINT "expense_form_fields_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_form_fields_formId_idx" ON "expense_form_fields"("formId");
ALTER TABLE "expense_form_fields" ADD CONSTRAINT "expense_form_fields_formId_fkey" FOREIGN KEY ("formId") REFERENCES "expense_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
