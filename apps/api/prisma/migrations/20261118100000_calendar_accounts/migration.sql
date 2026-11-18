-- CreateTable
CREATE TABLE "calendar_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'google',
    "email" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "color" VARCHAR(20) NOT NULL DEFAULT '#047857',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_accounts_user_id_idx" ON "calendar_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_accounts_user_id_provider_email_key" ON "calendar_accounts"("user_id", "provider", "email");

