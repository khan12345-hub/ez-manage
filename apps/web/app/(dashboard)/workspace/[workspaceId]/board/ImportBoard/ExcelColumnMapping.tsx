"use client";

import { COLUMN_TYPES } from "./excelImport.constants";
import { ExcelColumnMappingDto } from "./excelImport.types";



interface ExcelColumnMappingProps {
  mappings: ExcelColumnMappingDto[];
  isImporting?: boolean;

  onChange: (
    sourceColumn: string,
    field: "targetColumn" | "type",
    value: string,
  ) => void;
}

export function ExcelColumnMapping({
  mappings,
  isImporting = false,
  onChange,
}: ExcelColumnMappingProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">
          Column Mapping
        </h3>

        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
          Configure how each Excel column should be
          created on the board.
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {mappings.map((mapping, index) => (
          <div
            key={mapping.sourceColumn}
            className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3 ${
              index !== mappings.length - 1
                ? "border-b border-gray-100 dark:border-zinc-800"
                : ""
            }`}
          >
            <div className="min-w-0">
              <p
                className="truncate text-xs font-medium text-gray-900 dark:text-white"
                title={mapping.sourceColumn}
              >
                {mapping.sourceColumn}
              </p>

              <p className="mt-0.5 text-[11px] text-gray-400">
                Excel column
              </p>
            </div>

            <div className="flex min-w-0 gap-2">
              <input
                value={mapping.targetColumn}
                onChange={(event) =>
                  onChange(
                    mapping.sourceColumn,
                    "targetColumn",
                    event.target.value,
                  )
                }
                disabled={isImporting}
                className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Board column"
              />

              <select
                value={mapping.type}
                onChange={(event) =>
                  onChange(
                    mapping.sourceColumn,
                    "type",
                    event.target.value,
                  )
                }
                disabled={isImporting}
                className="h-8 w-24 shrink-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {COLUMN_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}