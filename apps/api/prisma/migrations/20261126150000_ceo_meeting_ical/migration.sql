-- CEO meetings: a stable iCalendar UID + sequence so .ics invites update / cancel the same event
ALTER TABLE "ceo_meetings" ADD COLUMN "ical_uid" VARCHAR(255);
ALTER TABLE "ceo_meetings" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;

-- backfill existing rows with a unique UID, then enforce NOT NULL
UPDATE "ceo_meetings"
  SET "ical_uid" = 'ezm-' || "id"::text || '-' || md5(random()::text || clock_timestamp()::text)
  WHERE "ical_uid" IS NULL;

ALTER TABLE "ceo_meetings" ALTER COLUMN "ical_uid" SET NOT NULL;
