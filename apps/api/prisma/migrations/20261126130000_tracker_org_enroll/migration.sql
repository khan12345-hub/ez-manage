-- Hubstaff-style org enrollment: devices can enrol unassigned (org token) and be assigned later
ALTER TABLE "tracker_devices" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "tracker_devices" ADD COLUMN "assignedById" INTEGER;
ALTER TABLE "tracker_devices" ADD COLUMN "assignedAt" TIMESTAMP(3);

-- a deploy code with NULL userId is an organisation token (per-person codes keep their userId)
ALTER TABLE "tracker_deploy_codes" ALTER COLUMN "userId" DROP NOT NULL;
