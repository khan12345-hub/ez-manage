"use client";

import { AlertTriangle, Clock, Activity, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskOverview } from "@/services/ceo-assistant.api";

interface Props {
  stats: TaskOverview["stats"];
  myTasksCount?: number;
  onCardDetailClick?: (filter: "overdue" | "due_soon" | "my_tasks" | "inactive") => void;
}

const CARDS = [
  {
    key: "overdue" as const,
    label: "Overdue Tasks",
    sublabel: "Require immediate action",
    icon: AlertTriangle,
    bg:     "bg-gradient-to-br from-red-50 to-red-100/60 dark:from-red-950/40 dark:to-red-900/20",
    border: "border-red-200 dark:border-red-900/60",
    iconBg: "bg-red-500",
    numCls: "text-red-600 dark:text-red-400",
    btnCls: "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400",
    pulse:  true,
  },
  {
    key: "due_soon" as const,
    label: "Due Soon",
    sublabel: "Coming up in 7 days",
    icon: Clock,
    bg:     "bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20",
    border: "border-amber-200 dark:border-amber-900/60",
    iconBg: "bg-amber-500",
    numCls: "text-amber-600 dark:text-amber-400",
    btnCls: "border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400",
    pulse:  false,
  },
  {
    key: "my_tasks" as const,
    label: "My Tasks",
    sublabel: "Assigned to you",
    icon: UserCircle2,
    bg:     "bg-gradient-to-br from-violet-50 to-violet-100/60 dark:from-violet-950/40 dark:to-violet-900/20",
    border: "border-violet-200 dark:border-violet-900/60",
    iconBg: "bg-violet-500",
    numCls: "text-violet-600 dark:text-violet-400",
    btnCls: "border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400",
    pulse:  false,
  },
  {
    key: "inactive" as const,
    label: "Inactive Tasks",
    sublabel: "No recent activity",
    icon: Activity,
    bg:     "bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-800/20",
    border: "border-slate-200 dark:border-slate-700/60",
    iconBg: "bg-slate-500",
    numCls: "text-slate-600 dark:text-slate-400",
    btnCls: "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400",
    pulse:  false,
  },
] as const;

function getCount(key: string, stats: Props["stats"], myTasksCount: number) {
  if (key === "overdue")  return stats.overdueCount;
  if (key === "due_soon") return stats.dueSoonCount;
  if (key === "inactive") return stats.inactiveCount;
  if (key === "my_tasks") return myTasksCount;
  return 0;
}

export function OverviewCards({ stats, myTasksCount = 0, onCardDetailClick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const count = getCount(card.key, stats, myTasksCount);
        const urgent = card.pulse && count > 0;

        return (
          <div
            key={card.key}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md",
              card.bg, card.border,
            )}
          >
            {/* Top: icon + urgency dot */}
            <div className="flex items-center justify-between mb-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm", card.iconBg)}>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              {urgent && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
            </div>

            {/* Number */}
            <div className={cn("text-4xl font-black tabular-nums leading-none mb-1", card.numCls)}>
              {count}
            </div>

            {/* Labels */}
            <div className="text-sm font-bold text-foreground/80 mt-2">{card.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.sublabel}</div>

            {/* View details button */}
            {onCardDetailClick && count > 0 && (
              <button
                onClick={() => onCardDetailClick(card.key)}
                className={cn(
                  "mt-3 w-full rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  card.btnCls,
                )}
              >
                View {count} task{count !== 1 ? "s" : ""}
              </button>
            )}

            {/* Decorative arc */}
            <div
              className={cn(
                "pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10",
                card.iconBg,
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
