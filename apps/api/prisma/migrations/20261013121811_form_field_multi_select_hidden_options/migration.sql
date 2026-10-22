-- AlterTable
ALTER TABLE "board_form_fields" ADD COLUMN IF NOT EXISTS "multiSelect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "board_form_fields" ADD COLUMN IF NOT EXISTS "hiddenOptionIds" JSONB NOT NULL DEFAULT '[]';
