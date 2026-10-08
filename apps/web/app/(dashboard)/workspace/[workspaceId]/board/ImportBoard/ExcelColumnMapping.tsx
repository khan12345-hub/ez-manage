"use client";

import { COLUMN_TYPES } from "./excelImport.constants";
import { ExcelColumnMappingDto } from "./excelImport.types";

interface ExcelColumnMappingProps {
  mappings: ExcelColumnMappingDto[];
  isImporting?: boolean;
  onChange: (sourceColumn: string, field: "targetColumn" | "type", value: string) => void;
}

const SKIP_TYPES = new Set(["SKIP", "COMMENT", "FILE_FEEDBACK", "CREATION_LOG"]);

export function ExcelColumnMapping({ mappings, isImporting = false, onChange }: ExcelColumnMappingProps) {
  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Column Mapping</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Types are auto-detected. Change any before importing.
        </p>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {mappings.map((mapping, index) => {
          const typeInfo = COLUMN_TYPES.find((t) => t.value === mapping.type);
          const isSkipped = mapping.type === "SKIP";

          return (
            <div
              key={mapping.sourceColumn}
              className={`px-4 py-2.5 ${index !== mappings.length - 1 ? "border-b border-border" : ""} ${isSkipped ? "opacity-50" : ""}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                {/* Left: source column name */}
                <div className="min-w-0 flex items-center">
                  <p className="truncate text-xs font-medium text-foreground" title={mapping.sourceColumn}>
                    {mapping.sourceColumn}
                  </p>
                </div>

                {/* Right: target name + type selector */}
                <div className="flex min-w-0 gap-2">
                  <input
                    value={mapping.targetColumn}
                    onChange={(e) => onChange(mapping.sourceColumn, "targetColumn", e.target.value)}
                    disabled={isImporting || isSkipped}
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-emerald-500 disabled:opacity-50"
                    placeholder="Board column name"
                  />
                  <select
                    value={mapping.type}
                    onChange={(e) => onChange(mapping.sourceColumn, "type", e.target.value)}
                    disabled={isImporting}
                    className="h-8 w-28 shrink-0 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-emerald-500"
                  >
                    {COLUMN_TYPES.map((type) => (
                      <option key={type.value} value={type.value} title={type.description}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Type description hint */}
              {typeInfo && !SKIP_TYPES.has(mapping.type) && (
                <p className="mt-1 pl-0 text-[11px] text-muted-foreground leading-tight">
                  {typeInfo.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}