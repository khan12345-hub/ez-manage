import { Skeleton } from "@/components/ui/skeleton";

export function WorkspacePageSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Cover */}
      <Skeleton className="h-40 w-full rounded-none" />

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="-mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6">
          <div className="flex items-end gap-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-2xl ring-4 ring-background" />
            <div className="flex flex-col gap-2 pb-1">
              <Skeleton className="h-6 w-44" />
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-7 rounded-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-6 border-b border-slate-200 pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-4 w-16" />
          ))}
        </div>

        {/* AI section placeholder */}
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />

        {/* Board/content grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>

        {/* Recent activity row */}
        <div className="mt-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-sm" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
