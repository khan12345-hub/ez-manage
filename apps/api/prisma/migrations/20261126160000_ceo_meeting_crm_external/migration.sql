-- External (email-only) meeting attendees + optional CRM link on CEO meetings
ALTER TABLE "ceo_meeting_attendees" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "ceo_meeting_attendees" ADD COLUMN "email" VARCHAR(320);
ALTER TABLE "ceo_meeting_attendees" ADD COLUMN "name"  VARCHAR(255);

ALTER TABLE "ceo_meetings" ADD COLUMN "crm_workspace_id" INTEGER;
ALTER TABLE "ceo_meetings" ADD COLUMN "crm_contact_id"   INTEGER;
ALTER TABLE "ceo_meetings" ADD COLUMN "crm_company_id"   INTEGER;
CREATE INDEX "ceo_meetings_crm_contact_id_idx" ON "ceo_meetings"("crm_contact_id");
CREATE INDEX "ceo_meetings_crm_company_id_idx" ON "ceo_meetings"("crm_company_id");
