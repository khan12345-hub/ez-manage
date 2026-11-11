-- AlterTable
ALTER TABLE "work_channel_members" ADD COLUMN     "sectionId" INTEGER;

-- CreateTable
CREATE TABLE "work_chat_sections" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chat_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_chat_sections_workspaceId_userId_idx" ON "work_chat_sections"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "work_channel_members" ADD CONSTRAINT "work_channel_members_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "work_chat_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_sections" ADD CONSTRAINT "work_chat_sections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "work_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chat_sections" ADD CONSTRAINT "work_chat_sections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

