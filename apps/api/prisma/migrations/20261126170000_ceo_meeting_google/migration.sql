-- Link a CEO meeting to the Google Calendar event we create for it (Meet link + organizer's calendar)
ALTER TABLE "ceo_meetings" ADD COLUMN "google_event_id"   VARCHAR(255);
ALTER TABLE "ceo_meetings" ADD COLUMN "google_account_id" INTEGER;
