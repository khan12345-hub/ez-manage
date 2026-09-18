"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Filter, MoreHorizontal, Maximize2, Minimize2 } from "lucide-react";
import { getBoardTasks } from "@/services/boards.api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChartViewProps {
  board: any;
}

/* ─── helpers ─────────────────────────────────────────────────── */

function fmtCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function niceMax(max: number) {
  if (max === 0) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

/* ─── SVG Bar Chart ───────────────────────────────────────────── */

interface BarItem {
  label: string;
  color: string;
  count: number;
}

function StatusBarChart({
  items,
  height = 340,
}: {
  items: BarItem[];
  height?: number;
}) {
  const PAD_TOP = 32;
  const PAD_LEFT = 56;
  const PAD_RIGHT = 16;
  const PAD_BOTTOM = 110; // room for rotated labels
  const GRID_LINES = 5;

  const svgH = height;
  const chartH = svgH - PAD_TOP - PAD_BOTTOM;

  const maxVal = niceMax(Math.max(...items.map((i) => i.count), 1));

  const yTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((maxVal / GRID_LINES) * i),
  );

  // Dynamic bar width based on count
  const MIN_BAR_W = 28;
  const MAX_BAR_W = 72;
  const rawBarW = items.length > 0 ? Math.floor((800 - PAD_LEFT - PAD_RIGHT) / items.length) * 0.55 : 40;
  const barW = Math.min(MAX_BAR_W, Math.max(MIN_BAR_W, rawBarW));
  const gap = items.length > 0 ? Math.floor((800 - PAD_LEFT - PAD_RIGHT - items.length * barW) / (items.length + 1)) : 20;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${Math.max(800, PAD_LEFT + PAD_RIGHT + items.length * (barW + gap) + gap)} ${svgH}`}
        className="w-full"
        style={{ minWidth: `${Math.max(500, items.length * 55 + 80)}px`, height }}
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick) => {
          const y = PAD_TOP + chartH - (tick / maxVal) * chartH;
          return (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={PAD_LEFT + PAD_RIGHT + items.length * (barW + gap) + gap + 40}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#9ca3af"
              >
                {fmtCount(tick)}
              </text>
            </g>
          );
        })}

        {/* "Count" Y-axis label */}
        <text
          x={12}
          y={PAD_TOP + chartH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#6b7280"
          transform={`rotate(-90, 12, ${PAD_TOP + chartH / 2})`}
        >
          Count
        </text>

        {/* Bars */}
        {items.map((item, i) => {
          const barH = Math.max(item.count > 0 ? 3 : 0, (item.count / maxVal) * chartH);
          const x = PAD_LEFT + gap + i * (barW + gap);
          const barTop = PAD_TOP + chartH - barH;
          const labelY = PAD_TOP + chartH + 14;

          return (
            <g key={item.label}>
              {/* Bar */}
              <rect
                x={x}
                y={barTop}
                width={barW}
                height={barH}
                fill={item.color}
                rx={3}
                className="transition-all duration-300"
              />

              {/* Count label above bar */}
              {item.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={barTop - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="600"
                  fill="#111827"
                >
                  {item.count.toLocaleString()}
                </text>
              )}

              {/* Color indicator line below chart */}
              <rect
                x={x}
                y={PAD_TOP + chartH + 4}
                width={barW}
                height={3}
                rx={1.5}
                fill={item.color}
              />

              {/* Rotated x-axis label */}
              <text
                x={x + barW / 2}
                y={labelY + 6}
                textAnchor="end"
                fontSize={11}
                fill="#374151"
                transform={`rotate(-45, ${x + barW / 2}, ${labelY + 6})`}
              >
                {item.label.length > 18 ? item.label.slice(0, 17) + "…" : item.label}
              </text>
            </g>
          );
        })}

        {/* Zero count bars — show dash */}
        {items.map((item, i) => {
          if (item.count > 0) return null;
          const x = PAD_LEFT + gap + i * (barW + gap);
          const y = PAD_TOP + chartH;
          return (
            <text key={`zero-${item.label}`} x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#9ca3af">
              0
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Chart Widget Card ───────────────────────────────────────── */

type ChartSize = "normal" | "large";

function ChartWidget({
  title,
  subtitle,
  children,
  size,
  onSizeChange,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size: ChartSize;
  onSizeChange: (s: ChartSize) => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-background shadow-sm transition-all duration-200 ${
        size === "large" ? "col-span-2" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            title="Filter"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {subtitle && (
            <span className="mr-2 text-xs text-muted-foreground">{subtitle}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onSizeChange("normal")}>
                <Minimize2 className="mr-2 h-3.5 w-3.5" />
                Normal size
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSizeChange("large")}>
                <Maximize2 className="mr-2 h-3.5 w-3.5" />
                Full width
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── Main Chart View ─────────────────────────────────────────── */

export function ChartView({ board }: ChartViewProps) {
  const [statusSize, setStatusSize] = useState<ChartSize>("normal");
  const [groupSize, setGroupSize] = useState<ChartSize>("normal");

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["board-tasks-chart", board.id],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 500 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    enabled: !!board.id,
  });

  /* Auto-fetch all pages so chart always shows complete data */
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allTasks: any[] = Array.from(
    new Map((data?.pages.flatMap((p: any) => p.tasks) ?? []).map((t: any) => [t.id, t])).values()
  );
  const totalTasks = allTasks.length;

  /* Status chart data */
  const statusCol = board.columns?.find((c: any) => c.type === "STATUS");
  const statusOptions: any[] = statusCol?.statusOptions ?? [];

  const statusCounts: Record<string, number> = {};
  statusOptions.forEach((o: any) => { statusCounts[o.label] = 0; });
  statusCounts["No Status"] = 0;

  allTasks.forEach((task: any) => {
    const cell = task.cells?.find((c: any) => c.columnId === statusCol?.id);
    const label = (cell?.value as any)?.label as string | undefined;
    if (label && statusCounts[label] !== undefined) {
      statusCounts[label]++;
    } else {
      statusCounts["No Status"]++;
    }
  });

  const statusItems: BarItem[] = [
    ...statusOptions.map((opt: any) => ({
      label: opt.label as string,
      color: (opt.color as string) ?? "#9ca3af",
      count: statusCounts[opt.label as string] ?? 0,
    })),
    ...(statusCounts["No Status"] > 0
      ? [{ label: "No Status", color: "#9ca3af", count: statusCounts["No Status"] }]
      : []),
  ];

  /* Group chart data */
  const groups: any[] = board.groups ?? [];
  const groupCounts: Record<number, number> = {};
  groups.forEach((g: any) => { groupCounts[g.id] = 0; });
  allTasks.forEach((task: any) => {
    if (groupCounts[task.groupId] !== undefined) groupCounts[task.groupId]++;
  });

  const groupItems: BarItem[] = groups.map((g: any) => ({
    label: g.name as string,
    color: (g.color as string) ?? "#6b7280",
    count: groupCounts[g.id] ?? 0,
  }));

  /* Summary stats */
  const summaryStats = [
    { label: "Total Tasks", value: totalTasks.toLocaleString() },
    { label: "Groups", value: groups.length },
    { label: "Status Options", value: statusOptions.length },
    { label: "Columns", value: (board.columns ?? []).length },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-2 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border bg-background p-5">
            <div className="mb-4 h-4 w-32 rounded bg-muted" />
            <div className="h-64 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-2 md:grid-cols-2">
      {/* Status bar chart */}
      <ChartWidget
        title="Chart"
        subtitle={`${totalTasks.toLocaleString()} tasks`}
        size={statusSize}
        onSizeChange={setStatusSize}
      >
        {statusItems.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {!statusCol ? "No Status column found" : "No tasks yet"}
          </div>
        ) : (
          <StatusBarChart
            items={statusItems}
            height={statusSize === "large" ? 380 : 320}
          />
        )}
      </ChartWidget>

      {/* Group bar chart */}
      <ChartWidget
        title="Tasks by Group"
        subtitle={`${groups.length} groups`}
        size={groupSize}
        onSizeChange={setGroupSize}
      >
        {groupItems.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No groups
          </div>
        ) : (
          <StatusBarChart
            items={groupItems}
            height={groupSize === "large" ? 380 : 320}
          />
        )}
      </ChartWidget>

      {/* Summary row */}
      <div className="col-span-1 rounded-xl border bg-background shadow-sm md:col-span-2">
        <div className="border-b px-4 py-3">
          <span className="text-sm font-semibold">Summary</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {summaryStats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-muted/40 p-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
