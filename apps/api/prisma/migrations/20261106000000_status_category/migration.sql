-- Status groups (ClickUp-style): each status option says whether it means
-- Not started / Active / Done. "Done" and overdue are computed from this
-- instead of guessing from the label text.
CREATE TYPE "StatusCategory" AS ENUM ('NOT_STARTED', 'ACTIVE', 'DONE');

ALTER TABLE "StatusOption" ADD COLUMN "category" "StatusCategory" NOT NULL DEFAULT 'ACTIVE';

-- Backfill from existing labels (same rule as suggestStatusCategory()).
-- Negations ("Not Done", "Unpaid", "Partially Paid", "Pending ...") never count as done.
UPDATE "StatusOption" SET "category" = 'DONE'
WHERE "label" ~* '\m(done|complete|completed|finished|closed|resolved|deployed|shipped|paid|cancell?ed)\M'
  AND "label" !~* '\m(not|un|in|non)[ -]?(done|complete|completed|finished|paid|approved|resolved|closed)\M'
  AND "label" !~* '\m(pending|partial|partially|awaiting|unpaid)\M';

UPDATE "StatusOption" SET "category" = 'NOT_STARTED'
WHERE "category" <> 'DONE'
  AND ("label" ~* '^\s*(not started|to[ -]?do|new|open|backlog|planned|queued|pending|on hold|waiting)\M'
       OR "label" ~* '\mnot started\M');
