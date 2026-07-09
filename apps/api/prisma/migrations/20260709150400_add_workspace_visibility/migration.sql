-- CreateEnum
CREATE TYPE "WorkspaceVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "visibility" "WorkspaceVisibility" NOT NULL DEFAULT 'PRIVATE';

-- DropIndex
DROP INDEX IF EXISTS "workspaces_createdById_key";
