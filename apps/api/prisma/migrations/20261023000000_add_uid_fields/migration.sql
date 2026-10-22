-- Add uid (short unique identifier) to workspaces and boards.
-- Existing rows are backfilled with a 12-char hex string derived from
-- random bytes + the row id so there are no collisions within a table.

-- workspaces
ALTER TABLE "workspaces" ADD COLUMN "uid" TEXT;
UPDATE "workspaces"
  SET "uid" = left(md5(random()::text || id::text), 12)
  WHERE "uid" IS NULL;
ALTER TABLE "workspaces" ALTER COLUMN "uid" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_uid_key" ON "workspaces"("uid");

-- boards
ALTER TABLE "boards" ADD COLUMN "uid" TEXT;
UPDATE "boards"
  SET "uid" = left(md5(random()::text || id::text), 12)
  WHERE "uid" IS NULL;
ALTER TABLE "boards" ALTER COLUMN "uid" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "boards_uid_key" ON "boards"("uid");
