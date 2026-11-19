-- Executive Hub → My profile
ALTER TABLE "users" ADD COLUMN "bio" VARCHAR(500),
ADD COLUMN "email_signature" VARCHAR(2000),
ADD COLUMN "job_title" VARCHAR(80),
ADD COLUMN "timezone" VARCHAR(64);
