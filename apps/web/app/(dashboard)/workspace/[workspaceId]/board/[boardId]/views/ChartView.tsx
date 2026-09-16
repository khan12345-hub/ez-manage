"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getBoardTasks } from "@/services/boards.api";

interface ChartViewProps {
  board: any;
}

function PieChart({ slices }: { slices: { label: string; color: string; count: number; pct: number }[] }) {
  let cumulativePct = 0;
  const cx = 80, cy = 80, r = 70;

  function polarToCartesian(pct: number) {
    const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28 shrink-0 sm:h-40 sm:w-40">
      {slices.map((s, i) => {
        if (s.pct === 0) return null;
        const start = polarToCartesian(cumulativePct);
        cumulativePct += s.pct;
        const end = polarToCartesian(cumulativePct);
        const largeArc = s.pct > 50 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
        return <path key={i} d={d} fill={s.color} opacity={0.9} />;
      })}
      {slices.length === 0 && (
        <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
      )}
    </svg>
  );
}

function BarChart({ items }: { items: { label: string; color: string; count: number }[] }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">{item.count}</span>
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max((item.count / max) * 120, item.count > 0 ? 4 : 0)}px`,
              backgroundColor: item.color,
            }}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center" title={item.label}>
            {item.label.length > 5 ? item.label.slice(0, 4) + "…" : item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartView({ board }: ChartViewProps) {
  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["board-tasks-chart", board.id],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 500 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    enabled: !!board.id,
  });

  const allTasks: any[] = data?.pages.flatMap((p: any) => p.tasks) ?? [];

  // Status distribution
  const statusCol = board.columns?.find((c: any) => c.type === "STATUS");
  const statusOptions: any[] = statusCol?.statusOptions ?? [];

  const statusCounts: Record<string, number> = {};
  statusOptions.forEach((o: any) => { statusCounts[o.label] = 0; });
  statusCounts["No Status"] = 0;

  allTasks.forEach((task: any) => {
    const cell = task.cells?.find((c: any) => c.columnId === statusCol?.id);
    const label = (cell?.value as any)?.label as string | undefined;
    if (label && statusCounts[label] !== undefined) {
      statusCounts[label] = (statusCounts[label] ?? 0) + 1;
    } else {
      statusCounts["No Status"] = (statusCounts["No Status"] ?? 0) + 1;
    }
  });

  // Build slices (remove zero-count)
  const totalTasks = allTasks.length;
  const statusSlices = statusOptions
    .map((opt: any) => ({
      label: opt.label,
      color: opt.color ?? "#9ca3af",
      count: statusCounts[opt.label as string] ?? 0,
      pct: totalTasks > 0 ? ((statusCounts[opt.label as string] ?? 0) / totalTasks) * 100 : 0,
    }))
    .concat(
      (statusCounts["No Status"] ?? 0) > 0
        ? [{ label: "No Status", color: "#9ca3af", count: statusCounts["No Status"] ?? 0, pct: totalTasks > 0 ? ((statusCounts["No Status"] ?? 0) / totalTasks) * 100 : 0 }]
        : []
    )
    .filter((s) => s.count > 0);

  // Group distribution
  const groups: any[] = board.groups ?? [];
  const groupMap = new Map<number, any>();
  groups.forEach((g: any) => groupMap.set(g.id, g));

  const groupCounts: Record<number, number> = {};
  groups.forEach((g: any) => { groupCounts[g.id as number] = 0; });
  allTasks.forEach((task: any) => {
    if (groupCounts[task.groupId as number] !== undefined) {
      groupCounts[task.groupId as number] = (groupCounts[task.groupId as number] ?? 0) + 1;
    }
  });

  const groupItems = groups.map((g: any) => ({
    label: g.name,
    color: g.color ?? "#6b7280",
    count: groupCounts[g.id as number] ?? 0,
  }));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3 animate-pulse">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-40 rounded bg-muted/60" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
      {/* Status Pie Chart */}
      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Tasks by Status</h3>
          <p className="text-xs text-muted-foreground">{totalTasks} total tasks</p>
        </div>

        {statusSlices.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {!statusCol ? "No Status column" : "No tasks"}
          </div>
        ) : (
          <div className="flex items-start gap-5">
            <PieChart slices={statusSlices} />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 pt-2">
              {statusSlices.map((s) => (
                <div key={s.label} className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs truncate flex-1">{s.label}</span>
                  <span className="text-xs font-semibold tabular-nums shrink-0">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Group Bar Chart */}
      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Tasks by Group</h3>
          <p className="text-xs text-muted-foreground">{groups.length} groups</p>
        </div>

        {groupItems.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No groups
          </div>
        ) : (
          <BarChart items={groupItems} />
        )}

        {groupItems.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t">
            {groupItems.map((g) => (
              <div key={g.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <span className="text-xs truncate flex-1">{g.label}</span>
                <span className="text-xs font-semibold tabular-nums shrink-0">{g.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary card */}
      <div className="rounded-xl border p-5 space-y-3 md:col-span-2">
        <h3 className="text-sm font-semibold">Summary</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          {[
            { label: "Total Tasks", value: totalTasks },
            { label: "Groups", value: groups.length },
            { label: "Status Options", value: statusOptions.length },
            { label: "Columns", value: (board.columns ?? []).length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
