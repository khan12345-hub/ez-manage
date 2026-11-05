"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardAggregates } from "./useDashboardData";

const SERIES = [
  { key: "done" as const, label: "Completed", color: "#10b981" },
  { key: "inProgress" as const, label: "In Progress", color: "#8b5cf6" },
  { key: "overdue" as const, label: "Overdue", color: "#f43f5e" },
];

export function TaskOverviewChart() {
  const { daily, isLoading } = useDashboardAggregates();

  const maxVal = Math.max(
    1,
    ...daily.map((d) => Math.max(d.done, d.inProgress, d.overdue)),
  );
  // round up to a clean axis
  const axisMax = Math.max(4, Math.ceil(maxVal / 2) * 2);
  const ticks = [axisMax, Math.round(axisMax * 0.75), Math.round(axisMax / 2), Math.round(axisMax * 0.25), 0];

  const hasAny = daily.some((d) => d.done + d.inProgress + d.overdue > 0);

  return (
    <div
      className="rounded-2xl bg-card p-5"
      style={{
        border: "1px solid rgba(99, 102, 241, 0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Task Overview</h3>
          <p className="text-sm text-muted-foreground">Your tasks by due date · last 7 days</p>
        </div>
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-[220px] w-full rounded-xl" />
      ) : (
        <div className="relative mt-6 h-[220px]">
          {/* gridlines + y-axis */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {t}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            ))}
          </div>

          {/* bars */}
          <div className="absolute inset-0 ml-7 flex items-end justify-between gap-2">
            {daily.map((d, idx) => (
              <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-[196px] w-full items-end justify-center gap-[3px]">
                  {SERIES.map((s) => {
                    const v = d[s.key];
                    const pct = (v / axisMax) * 100;
                    return (
                      <motion.div
                        key={s.key}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(pct, v > 0 ? 3 : 0)}%` }}
                        transition={{ delay: 0.1 + idx * 0.06, duration: 0.5, ease: "easeOut" }}
                        className="w-2.5 rounded-t-md"
                        style={{ background: s.color }}
                        title={`${s.label}: ${v}`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>

          {!hasAny && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="rounded-lg bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                No tasks with due dates this week
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
