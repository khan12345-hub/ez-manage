-- AlterTable
ALTER TABLE "BoardFormField" ADD COLUMN "multiSelect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BoardFormField" ADD COLUMN "hiddenOptionIds" JSONB NOT NULL DEFAULT '[]';
