-- CreateTable
CREATE TABLE "work_task_watches" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_watches_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "work_comment_follows" (
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comment_follows_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "work_favorites" (
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_favorites_pkey" PRIMARY KEY ("userId","taskId")
);

-- CreateTable
CREATE TABLE "work_task_lists" (
    "taskId" INTEGER NOT NULL,
    "listId" INTEGER NOT NULL,
    "addedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_lists_pkey" PRIMARY KEY ("taskId","listId")
);

-- CreateIndex
CREATE INDEX "work_task_watches_userId_idx" ON "work_task_watches"("userId");

-- CreateIndex
CREATE INDEX "work_comment_follows_userId_idx" ON "work_comment_follows"("userId");

-- CreateIndex
CREATE INDEX "work_favorites_taskId_idx" ON "work_favorites"("taskId");

-- CreateIndex
CREATE INDEX "work_task_lists_listId_idx" ON "work_task_lists"("listId");

-- AddForeignKey
ALTER TABLE "work_task_watches" ADD CONSTRAINT "work_task_watches_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_watches" ADD CONSTRAINT "work_task_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_follows" ADD CONSTRAINT "work_comment_follows_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "work_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_follows" ADD CONSTRAINT "work_comment_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_favorites" ADD CONSTRAINT "work_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_favorites" ADD CONSTRAINT "work_favorites_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_lists" ADD CONSTRAINT "work_task_lists_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_lists" ADD CONSTRAINT "work_task_lists_listId_fkey" FOREIGN KEY ("listId") REFERENCES "work_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

