-- Add updatedAt to task_cells for optimistic concurrency control.
-- Backfill existing rows with NOW() so NOT NULL is satisfied immediately.

ALTER TABLE "task_cells" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
