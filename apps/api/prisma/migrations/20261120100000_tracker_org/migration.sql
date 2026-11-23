-- EZ Tracker becomes one organization-wide tracker (source 'org', workspaceId 0).
-- Collapse all existing per-company tracker data into the single org row. Data-only; no DDL.
DO $$
DECLARE org_id int;
BEGIN
  -- the single org-level tracker (reuse the most recently updated existing org's settings)
  INSERT INTO tracker_orgs (source, "workspaceId", settings, "createdAt", "updatedAt")
  VALUES ('org', 0, COALESCE((SELECT settings FROM tracker_orgs WHERE source <> 'org' ORDER BY "updatedAt" DESC LIMIT 1), '{}'::jsonb), now(), now())
  ON CONFLICT (source, "workspaceId") DO NOTHING;
  SELECT id INTO org_id FROM tracker_orgs WHERE source = 'org' AND "workspaceId" = 0;

  -- child tables whose uniques are independent of orgId: bulk re-point
  UPDATE tracker_sessions   SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_slots      SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_shots      SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_app_usage  SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_devices    SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_pair_codes SET "orgId" = org_id WHERE "orgId" <> org_id;
  UPDATE tracker_reminders  SET "orgId" = org_id WHERE "orgId" <> org_id;

  -- tracker_members: unique(orgId,userId). Keep one per user (prefer admin), then move to org.
  DELETE FROM tracker_members c
   WHERE c."orgId" <> org_id
     AND EXISTS (SELECT 1 FROM tracker_members o WHERE o."orgId" = org_id AND o."userId" = c."userId");
  DELETE FROM tracker_members a USING tracker_members b
   WHERE a."userId" = b."userId" AND a."orgId" <> org_id AND b."orgId" <> org_id
     AND (b.role = 'admin' AND a.role <> 'admin' OR (a.role = b.role AND a.id > b.id));
  UPDATE tracker_members SET "orgId" = org_id WHERE "orgId" <> org_id;

  -- tracker_consents: unique(orgId,userId,version). Drop dupes before re-pointing.
  DELETE FROM tracker_consents c
   WHERE c."orgId" <> org_id
     AND EXISTS (SELECT 1 FROM tracker_consents o WHERE o."orgId" = org_id AND o."userId" = c."userId" AND o.version = c.version);
  DELETE FROM tracker_consents a USING tracker_consents b
   WHERE a.id > b.id AND a."orgId" <> org_id AND b."orgId" <> org_id AND a."userId" = b."userId" AND a.version = b.version;
  UPDATE tracker_consents SET "orgId" = org_id WHERE "orgId" <> org_id;

  -- drop the now-empty per-company tracker orgs
  DELETE FROM tracker_orgs WHERE source <> 'org';
END $$;
