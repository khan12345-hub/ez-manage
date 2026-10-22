-- Rename updated_at → "updatedAt" to match Prisma camelCase convention.
-- The prior migration used snake_case which Prisma cannot map without @map.

ALTER TABLE "task_cells" RENAME COLUMN "updated_at" TO "updatedAt";
