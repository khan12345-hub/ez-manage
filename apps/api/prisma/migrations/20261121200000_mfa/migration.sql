-- Multi-factor authentication: TOTP authenticator + email code + recovery codes.
ALTER TABLE "users"
  ADD COLUMN "mfa_totp_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfa_totp_secret" TEXT,
  ADD COLUMN "mfa_email_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfa_enrolled_at" TIMESTAMP(3);

CREATE TABLE "mfa_recovery_codes" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "code_hash" TEXT NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes" ("user_id");

ALTER TABLE "mfa_recovery_codes"
  ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
