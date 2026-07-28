"use client";

import { Skeleton } from "@/components/ui/skeleton";

const TASK_ROWS = 6;

export function BoardSkeleton() {
  return (
    <div className="w-full overflow-hidden">
      {/* ==========================================
          BOARD TOP HEADER
      ========================================== */}
      <div className="flex h-24 items-center justify-between border-b px-6">
        <Skeleton className="h-7 w-36" />

        <div className="flex items-center gap-7">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-5 w-5" />
        </div>
      </div>

      {/* ==========================================
          BOARD TOOLBAR
      ========================================== */}
      <div className="flex h-20 items-center gap-6 px-12">
        <Skeleton className="h-9 w-28 rounded-md" />

        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-6" />
      </div>

      {/* ==========================================
          GROUP HEADER
      ========================================== */}
      <div className="flex h-14 items-center border-b px-6">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="ml-10 h-5 w-28" />
      </div>

      {/* ==========================================
          COLUMN HEADER
      ========================================== */}
      <div className="grid h-16 grid-cols-[175px_minmax(300px,1fr)_200px_200px_250px_150px] border-b">
        <div className="flex items-center px-8">
          <Skeleton className="h-5 w-5" />
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="flex items-center justify-center">
          <Skeleton className="h-5 w-12" />
        </div>
      </div>

      {/* ==========================================
          TASK ROWS
      ========================================== */}
      {Array.from({ length: TASK_ROWS }).map((_, index) => (
        <SkeletonTaskRow key={index} index={index} />
      ))}

      {/* ==========================================
          ADD TASK
      ========================================== */}
      <div className="grid h-14 grid-cols-[175px_minmax(300px,1fr)_200px_200px_250px_150px] border-b">
        <div />

        <div className="flex items-center gap-3 px-4">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-4 w-20" />
        </div>

        <div />
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

function SkeletonTaskRow({
  index,
}: {
  index: number;
}) {
  return (
    <div className="grid h-80px grid-cols-[175px_minmax(300px,1fr)_200px_200px_250px_150px] border-b">
      {/* Drag + checkbox */}
      <div className="flex items-center gap-5 px-8">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-5 w-5 rounded-sm" />
      </div>

      {/* Task */}
      <div className="flex items-center gap-4 px-6">
        <Skeleton className="h-8 w-8 rounded-md" />

        <Skeleton
          className={`h-5 ${
            index % 3 === 0
              ? "w-32"
              : index % 3 === 1
                ? "w-44"
                : "w-24"
          }`}
        />

        {/* Comment icon */}
        <Skeleton className="ml-auto h-8 w-8 rounded-full" />
      </div>

      {/* Person */}
      <div className="flex items-center px-4">
        {index % 2 === 0 ? (
          <div className="flex -space-x-2">
            <Skeleton className="h-9 w-9 rounded-full border-2 border-background" />
            <Skeleton className="h-9 w-9 rounded-full border-2 border-background" />
          </div>
        ) : (
          <Skeleton className="h-5 w-28" />
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-center">
        <Skeleton className="h-12 w-full rounded-none" />
      </div>

      {/* Date */}
      <div className="flex items-center px-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* File */}
      <div className="flex items-center px-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}