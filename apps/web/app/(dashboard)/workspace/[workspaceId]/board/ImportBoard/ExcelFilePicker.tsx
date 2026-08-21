"use client";

import {
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";

import type { RefObject } from "react";

interface ExcelFilePickerProps {
  file: File | null;
  rowsCount: number;

  inputRef: RefObject<HTMLInputElement | null>;

  previewFile: unknown;

  disabled?: boolean;
  isImporting?: boolean;

  onSelect: (file: File | undefined) => void;
  onPreview: () => void;
  onChange: () => void;
  onRemove: () => void;
}

export function ExcelFilePicker({
  file,
  rowsCount,
  inputRef,
  previewFile,
  disabled = false,
  isImporting = false,
  onSelect,
  onPreview,
  onChange,
  onRemove,
}: ExcelFilePickerProps) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => {
          onSelect(event.target.files?.[0]);
        }}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isImporting}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Upload className="h-5 w-5" />
          </div>

          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Choose an Excel file
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            .xlsx or .xls files are supported
          </p>
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            <button
              type="button"
              onClick={() => {
                if (previewFile) {
                  onPreview();
                }
              }}
              className="min-w-0 flex-1 overflow-hidden text-left"
            >
              <p
                className="truncate text-sm font-semibold text-gray-900 hover:underline dark:text-white"
                title={file.name}
              >
                {file.name}
              </p>

              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                {(file.size / 1024).toFixed(1)} KB
                {" · "}
                {rowsCount
                  ? `${rowsCount} row${
                      rowsCount === 1 ? "" : "s"
                    }`
                  : "Reading file..."}
              </p>
            </button>

            <button
              type="button"
              onClick={onChange}
              disabled={isImporting}
              className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              Change
            </button>

            <button
              type="button"
              onClick={onRemove}
              disabled={isImporting}
              className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800"
              aria-label="Remove Excel file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}