"use client";

import { parseISO, isAfter, isBefore } from "date-fns";

import { FormDatePicker } from "./FormDatePicker";

interface TimelineValue {
  startDate?: string;
  endDate?: string;
}

interface FormTimelinePickerProps {
  value: TimelineValue | undefined;
  onChange: (value: TimelineValue) => void;
  disabled?: boolean;
}

/**
 * Two date pickers for TIMELINE column type (start/end date range).
 * Constrains end date to be on or after start date and vice-versa.
 */
export function FormTimelinePicker({
  value,
  onChange,
  disabled = false,
}: FormTimelinePickerProps) {
  const startDate = value?.startDate
    ? parseISO(value.startDate)
    : undefined;

  const endDate = value?.endDate
    ? parseISO(value.endDate)
    : undefined;

  function handleStartChange(iso: string) {
    const next: TimelineValue = { ...value, startDate: iso || undefined };

    // Clear end date if it's now before the new start date
    if (iso && next.endDate) {
      const newStart = parseISO(iso);
      const existingEnd = parseISO(next.endDate);

      if (isBefore(existingEnd, newStart)) {
        next.endDate = undefined;
      }
    }

    onChange(next);
  }

  function handleEndChange(iso: string) {
    onChange({ ...value, endDate: iso || undefined });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Start date
        </p>

        <FormDatePicker
          value={value?.startDate ?? ""}
          onChange={handleStartChange}
          disabled={disabled}
          placeholder="Start date"
          toDate={endDate}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          End date
        </p>

        <FormDatePicker
          value={value?.endDate ?? ""}
          onChange={handleEndChange}
          disabled={disabled}
          placeholder="End date"
          fromDate={startDate}
        />
      </div>
    </div>
  );
}
