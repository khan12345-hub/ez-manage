-- Deleting a parent task now deletes its subtasks (was SET NULL, which
-- silently turned subtasks into top-level tasks).
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parentId_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
