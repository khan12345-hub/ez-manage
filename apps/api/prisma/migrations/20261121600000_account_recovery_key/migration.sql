-- Account Recovery Key (the "Account Kit" emailed at sign-up).
ALTER TABLE "users" ADD COLUMN "recovery_key_hash" TEXT;
