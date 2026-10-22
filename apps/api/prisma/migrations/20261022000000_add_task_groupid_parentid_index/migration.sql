-- Add composite index on (groupId, parentId) to speed up the
-- parentId: null predicate that every paginated board-tasks query
-- applies when filtering out subtasks.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tasks_groupId_parentId_idx"
    ON "tasks" ("groupId", "parentId");
