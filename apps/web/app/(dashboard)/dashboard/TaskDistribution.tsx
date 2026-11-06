"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardAggregates } from "./useDashboardData";

export function TaskDistribution() {
  const { distribution, totalTasks, isLoading } = useDashboardAggregates();

  const r = 54;
  const circ = 2 * Math.PI * r;

  // build cumulative segments
  let offset = 0;
  const segments = distribution.map((d) => {
    const frac = totalTasks > 0 ? d.count / totalTasks : 0;
    const seg = { ...d, frac, dash: frac * circ, offset };
    offset += frac * circ;
    return seg;
  });

  return (
    <div
      className="rounded-2xl bg-card p-5"
      style={{
        border: "1px solid rgba(4,120,87,0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <h3 className="font-serif text-[21px] font-normal leading-none text-foreground">Task Distribution</h3>
      <p className="text-sm text-muted-foreground">By status across your tasks</p>

      {isLoading ? (
        <div className="mt-5 flex items-center gap-6">
          <Skeleton className="h-[150px] w-[150px] rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded" />
            ))}
          </div>
        </div>
      ) : totalTasks === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-[10px] border-border">
            <span className="text-sm font-medium text-muted-foreground">No tasks</span>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
            <svg className="-rotate-90" width={150} height={150} viewBox="0 0 150 150">
              <circle cx="75" cy="75" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
              {segments.map((s) => (
                <motion.circle
                  key={s.bucket}
                  cx="75"
                  cy="75"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${s.dash} ${circ}`}
                  initial={{ strokeDashoffset: -circ }}
                  animate={{ strokeDashoffset: -s.offset }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">{totalTasks}</span>
              <span className="text-[11px] text-muted-foreground">Total Tasks</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            {segments.map((s) => (
              <div key={s.bucket} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
