"use client";

import { useCeoAssistantStore } from "@/store/ceo-assistant-store";
import { Label } from "@/components/ui/label";

const INACTIVITY_OPTIONS = [1, 2, 3, 5, 7] as const;
const UPCOMING_OPTIONS = [1, 3, 7, 14] as const;

export function FilterBar({ onRefresh }: { onRefresh: () => void }) {
  const { filters, setFilters } = useCeoAssistantStore();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
          Inactive after
        </Label>
        <div className="flex gap-1">
          {INACTIVITY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setFilters({ inactivityDays: d }); onRefresh(); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.inactivityDays === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
          Due within
        </Label>
        <div className="flex gap-1">
          {UPCOMING_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setFilters({ upcomingDays: d }); onRefresh(); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.upcomingDays === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto">
        <button
          onClick={onRefresh}
          className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
