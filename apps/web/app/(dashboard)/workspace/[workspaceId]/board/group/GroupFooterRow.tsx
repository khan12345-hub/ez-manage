"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Aggregation types ─────────────────────────────────────────────────────────
type AggType =
  | "none"
  | "sum" | "avg" | "min" | "max"
  | "count"
  | "unique"
  | "checked" | "unchecked"
  | "earliest" | "latest";

interface AggOption { label: string; value: AggType }

const AGG_OPTIONS: Record<string, AggOption[]> = {
  NUMBER: [
    { label: "None",    value: "none"  },
    { label: "Sum",     value: "sum"   },
    { label: "Average", value: "avg"   },
    { label: "Min",     value: "min"   },
    { label: "Max",     value: "max"   },
    { label: "Count",   value: "count" },
  ],
  PRICE: [
    { label: "None",    value: "none"  },
    { label: "Sum",     value: "sum"   },
    { label: "Average", value: "avg"   },
    { label: "Min",     value: "min"   },
    { label: "Max",     value: "max"   },
    { label: "Count",   value: "count" },
  ],
  TEXT:      [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }, { label: "Unique", value: "unique" }],
  LONG_TEXT: [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }, { label: "Unique", value: "unique" }],
  DROPDOWN:  [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }, { label: "Unique", value: "unique" }],
  LABEL:     [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }, { label: "Unique", value: "unique" }],
  EMAIL:     [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }],
  LINK:      [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }],
  STATUS:    [{ label: "None", value: "none" }, { label: "Count",  value: "count"  }, { label: "Unique Labels", value: "unique"  }],
  DATE: [
    { label: "None",     value: "none"     },
    { label: "Count",    value: "count"    },
    { label: "Earliest", value: "earliest" },
    { label: "Latest",   value: "latest"   },
  ],
  TIMELINE:     [{ label: "None", value: "none" }, { label: "Count", value: "count" }],
  CHECKBOX:     [{ label: "None", value: "none" }, { label: "Checked",   value: "checked"   }, { label: "Unchecked", value: "unchecked" }, { label: "Count", value: "count" }],
  PERSON:       [{ label: "None", value: "none" }, { label: "Count",     value: "count"     }, { label: "Unique People", value: "unique" }],
  FILE:         [{ label: "None", value: "none" }, { label: "Count",     value: "count"     }],
  CREATION_LOG: [{ label: "None", value: "none" }, { label: "Count",     value: "count"     }],
};

// ── Aggregation computation ───────────────────────────────────────────────────
interface AggResult {
  display: string;
  label: string;
  extra?: number;
}

function getCells(tasks: any[], columnId: number): any[] {
  return tasks.flatMap((t) => (t.cells ?? []).filter((c: any) => c.columnId === columnId));
}

function fmtNum(n: number): string {
  const s = n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function computeAgg(tasks: any[], column: any, aggType: AggType): AggResult | null {
  if (aggType === "none") return null;

  const colType: string = column.type;
  const cells = getCells(tasks, column.id);

  switch (aggType) {
    case "count": {
      const n = cells.filter((c) => {
        if (colType === "CHECKBOX") return true;
        const v = c.value;
        if (v == null || v === "") return false;
        if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
        return true;
      }).length;
      return { display: String(n), label: "count" };
    }

    case "sum": case "avg": case "min": case "max": {
      const nums = cells
        .map((c) => parseFloat(String(c.value?.text ?? c.value ?? "").replace(/[$,]/g, "")))
        .filter((n) => !isNaN(n));
      if (!nums.length) return null;
      let result: number;
      if      (aggType === "sum") result = nums.reduce((a, b) => a + b, 0);
      else if (aggType === "avg") result = nums.reduce((a, b) => a + b, 0) / nums.length;
      else if (aggType === "min") result = Math.min(...nums);
      else                        result = Math.max(...nums);
      const labelMap: Record<string, string> = { sum: "sum", avg: "average", min: "min", max: "max" };
      const isPrice = colType === "PRICE";
      const formatted = isPrice
        ? `$${result.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : fmtNum(result);
      return { display: formatted, label: labelMap[aggType] };
    }

    case "unique": {
      let vals: string[];
      if (colType === "STATUS") {
        vals = cells.map((c) => c.value?.label).filter(Boolean);
      } else if (colType === "PERSON") {
        vals = cells.flatMap((c) =>
          (c.value?.users ?? []).map((u: any) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim())
        ).filter(Boolean);
      } else {
        vals = cells
          .map((c) => c.value?.text ?? String(c.value ?? ""))
          .filter((v) => v && v !== "null" && v !== "undefined" && v !== "");
      }
      const unique = Array.from(new Set(vals));
      if (!unique.length) return null;
      return { display: unique[0], label: "unique", extra: unique.length - 1 };
    }

    case "checked": case "unchecked": {
      const n = cells.filter((c) => {
        const v = c.value?.checked ?? c.value;
        return aggType === "checked" ? v === true : v !== true;
      }).length;
      return { display: String(n), label: aggType };
    }

    case "earliest": case "latest": {
      const dates = cells
        .map((c) => c.value?.date)
        .filter(Boolean)
        .map((d: string) => new Date(d))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      if (!dates.length) return null;
      const d = aggType === "earliest" ? dates[0] : dates[dates.length - 1];
      return { display: d.toLocaleDateString(), label: aggType };
    }
  }
  return null;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function getStoredAgg(columnId: number): AggType {
  try { return (localStorage.getItem(`footer-agg-${columnId}`) as AggType) || "none"; }
  catch { return "none"; }
}

function setStoredAgg(columnId: number, agg: AggType) {
  try { localStorage.setItem(`footer-agg-${columnId}`, agg); }
  catch {}
}

// ── Individual footer cell ────────────────────────────────────────────────────
function FooterCell({ column, tasks, allTasksLoaded }: { column: any; tasks: any[]; allTasksLoaded?: boolean }) {
  const [aggType, setAggType] = useState<AggType>("none");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setAggType(getStoredAgg(column.id));
  }, [column.id]);

  const options = AGG_OPTIONS[column.type as string] ?? [{ label: "None", value: "none" as AggType }];
  const result = computeAgg(tasks, column, aggType);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (v: AggType) => {
    setAggType(v);
    setStoredAgg(column.id, v);
    setOpen(false);
  };

  const hintLabel = options.find((o) => o.value !== "none")?.label ?? "Summarize";

  return (
    <td
      ref={ref}
      className="relative border px-2 py-1"
      style={{ minWidth: 150, maxWidth: 200 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex w-full items-center justify-between gap-1 rounded px-1.5 py-1 transition-colors",
          open ? "bg-accent" : "hover:bg-accent/50"
        )}
      >
        {result ? (
          <div className="flex flex-col items-start leading-none gap-0.5 min-w-0">
            <div className="flex items-center gap-1 max-w-full">
              {/* Show ~ when the agg is a numeric aggregate and not all tasks are loaded */}
              {!allTasksLoaded && ["sum","avg","min","max"].includes(aggType) && (
                <span className="text-[11px] text-amber-500" title="Loading all tasks…">~</span>
              )}
              <span className="truncate text-[13px] font-semibold text-foreground">{result.display}</span>
              {result.extra != null && result.extra > 0 && (
                <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
                  +{result.extra}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/50">{result.label}</span>
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100">
            {hintLabel}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform",
            open && "rotate-180",
            !result && "opacity-0 group-hover:opacity-100"
          )}
        />
      </button>

      {/* Dropdown — opens above the footer row */}
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[150px] overflow-hidden rounded-lg border bg-popover shadow-lg">
          <p className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {column.name}
          </p>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent",
                aggType === opt.value && "text-primary"
              )}
            >
              <span className="flex-1">{opt.label}</span>
              {aggType === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </td>
  );
}

// ── GroupFooterRow ────────────────────────────────────────────────────────────
export function GroupFooterRow({
  tasks,
  columns,
  color,
  allTasksLoaded = false,
}: {
  tasks: any[];
  columns: any[];
  color?: string;
  allTasksLoaded?: boolean;
}) {
  return (
    <tfoot>
      <tr>
        {/* Color strip matching the group */}
        <td
          className="sticky left-0 w-1.5 border"
          style={{ backgroundColor: color ?? "transparent" }}
        />

        {/* Item / name column */}
        <td className="sticky left-1.5 z-10 w-[200px] border px-3 py-1.5 sm:w-[450px]">
          <span className="text-[11px] font-medium text-muted-foreground/50">Summary</span>
        </td>

        {/* One cell per board column */}
        {columns.map((col) => (
          <FooterCell key={col.id} column={col} tasks={tasks} allTasksLoaded={allTasksLoaded} />
        ))}

        {/* Empty spacer for "Add Column" slot */}
        <td className="w-44 border" />
      </tr>
    </tfoot>
  );
}
