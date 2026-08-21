"use client";

import { ChevronDown } from "lucide-react";

interface ExcelTaskGroupSettingsProps {
  headers: string[];
  taskColumn: string;
  groupColumn: string;

  isImporting?: boolean;

  onTaskColumnChange: (value: string) => void;
  onGroupColumnChange: (value: string) => void;
}

export function ExcelTaskGroupSettings({
  headers,
  taskColumn,
  groupColumn,
  isImporting = false,
  onTaskColumnChange,
  onGroupColumnChange,
}: ExcelTaskGroupSettingsProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">
          Task & Group
        </h3>

        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
          Select which Excel columns contain your tasks
          and groups.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium">
            Task Column
          </label>

          <div className="relative">
            <select
              value={taskColumn}
              onChange={(event) =>
                onTaskColumnChange(event.target.value)
              }
              disabled={isImporting}
              className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white px-3 pr-8 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">
                Select task column
              </option>

              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">
            Group Column{" "}
            <span className="font-normal text-gray-400">
              (optional)
            </span>
          </label>

          <div className="relative">
            <select
              value={groupColumn}
              onChange={(event) =>
                onGroupColumnChange(event.target.value)
              }
              disabled={isImporting}
              className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white px-3 pr-8 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">No group column</option>

              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}