"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask, type RecurrenceType } from "@/services/tasks.api";
import { useInviteModalStore } from "@/store/invite-modal";

interface RecurrenceSelectorProps {
  taskId: number;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
}

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  NONE: "Does not repeat",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const INTERVAL_LABELS: Record<RecurrenceType, string> = {
  NONE: "",
  DAILY: "day(s)",
  WEEKLY: "week(s)",
  MONTHLY: "month(s)",
  YEARLY: "year(s)",
};

export function RecurrenceSelector({
  taskId,
  recurrenceType,
  recurrenceInterval,
  recurrenceEndDate,
}: RecurrenceSelectorProps) {
  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const [type, setType] = useState<RecurrenceType>(recurrenceType ?? "NONE");
  const [interval, setInterval] = useState<number>(recurrenceInterval ?? 1);
  const [endDate, setEndDate] = useState<string>(recurrenceEndDate ?? "");

  const mutation = useMutation({
    mutationFn: (data: {
      recurrenceType: RecurrenceType;
      recurrenceInterval: number;
      recurrenceEndDate: string | null;
    }) => updateTask(boardId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const save = (
    newType: RecurrenceType,
    newInterval: number,
    newEndDate: string
  ) => {
    mutation.mutate({
      recurrenceType: newType,
      recurrenceInterval: newInterval,
      recurrenceEndDate: newEndDate || null,
    });
  };

  const handleTypeChange = (value: RecurrenceType) => {
    setType(value);
    save(value, interval, endDate);
  };

  const handleIntervalChange = (value: number) => {
    const v = Math.max(1, value);
    setInterval(v);
    save(type, v, endDate);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    save(type, interval, value);
  };

  const handleClear = () => {
    setType("NONE");
    setInterval(1);
    setEndDate("");
    save("NONE", 1, "");
  };

  return (
    <div className="px-6 py-3 border-b border-border bg-muted/50">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Repeat</span>

        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as RecurrenceType)}
          className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map((t) => (
            <option key={t} value={t}>
              {RECURRENCE_LABELS[t]}
            </option>
          ))}
        </select>

        {type !== "NONE" && (
          <>
            <span className="text-xs text-muted-foreground">every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="w-12 text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">{INTERVAL_LABELS[type]}</span>
            <span className="text-xs text-muted-foreground ml-1">until</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleClear}
              title="Remove recurrence"
              className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}

        {type !== "NONE" && (
          <span className="ml-auto text-[10px] text-primary font-medium bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
            Recurring
          </span>
        )}
      </div>
    </div>
  );
}
