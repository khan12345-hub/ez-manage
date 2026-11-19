-- Conversations are shown only to the people in them.
-- Every channel becomes members-only, except each workspace's all-hands channel (isDefault).
-- Before the switch, everyone who took part is made a member so nobody loses a conversation they were in.

ALTER TABLE "work_channels" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_channels" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Accounts & Invoices: #general stays open to the whole workspace (everyone is already in it)
UPDATE "chat_channels" SET "isDefault" = true WHERE "name" = 'general' AND "type" = 'CHANNEL';

-- Company Work: people who wrote, were @mentioned, or were given a task from the channel become members
-- (still Work members of that workspace; not someone who later left the channel themselves)
INSERT INTO "work_channel_members" ("channelId", "userId", "lastReadAt", "joinedAt")
SELECT p."channelId", p."userId", now(), now()
FROM (
  SELECT m."channelId", m."userId", m."createdAt" FROM "work_chat_messages" m
   WHERE m."kind" <> 'system' AND m."deletedAt" IS NULL
  UNION ALL
  SELECT m."channelId", unnest(m."mentionIds"), m."createdAt" FROM "work_chat_messages" m
   WHERE m."deletedAt" IS NULL
  UNION ALL
  SELECT t."sourceChannelId", a."userId", t."createdAt" FROM "work_tasks" t
    JOIN "work_task_assignees" a ON a."taskId" = t."id"
   WHERE t."sourceChannelId" IS NOT NULL
) p
JOIN "work_channels" c ON c."id" = p."channelId" AND c."kind" = 'channel'
JOIN "work_members" wm ON wm."workspaceId" = c."workspaceId" AND wm."userId" = p."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "work_chat_messages" l
   WHERE l."channelId" = p."channelId" AND l."userId" = p."userId" AND l."kind" = 'system'
     AND l."content" = 'left the channel' AND l."createdAt" > p."createdAt"
)
ON CONFLICT ("channelId", "userId") DO NOTHING;

-- Accounts & Invoices: people who wrote in a channel become members (still in the workspace)
INSERT INTO "chat_members" ("channelId", "userId", "lastReadAt", "joinedAt")
SELECT DISTINCT m."channelId", m."userId", now(), now()
FROM "chat_messages" m
JOIN "chat_channels" c ON c."id" = m."channelId" AND c."type" = 'CHANNEL'
JOIN "workspace_members" wm ON wm."workspaceId" = c."workspaceId" AND wm."userId" = m."userId" AND wm."deleted_at" IS NULL
WHERE m."isSystemMessage" = false
ON CONFLICT ("channelId", "userId") DO NOTHING;
