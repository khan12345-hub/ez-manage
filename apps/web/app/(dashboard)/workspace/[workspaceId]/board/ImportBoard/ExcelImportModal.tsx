"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Columns3,
  Database,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Rows3,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import SingleFilePreviewModal from "@/app/(dashboard)/workspace/[workspaceId]/board/Cells/File/Previews/SingleFilePreviewModal";

import { useExcelImport } from "./useExcelImport";
import { ExcelFilePicker } from "./ExcelFilePicker";
import { ExcelImportSettings } from "./ExcelImportSettings";
import { ExcelTaskGroupSettings } from "./ExcelTaskGroupSettings";
import { ExcelColumnMapping } from "./ExcelColumnMapping";

import type { ExcelImportProps } from "./excelImport.types";

function ExcelImportProgress({
  rowsCount,
  columnsCount,
}: {
  rowsCount: number;
  columnsCount: number;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 3000),
      setTimeout(() => setStep(4), 4500),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const steps = [
    {
      label: "Reading Excel data",
      description: `Processing ${rowsCount.toLocaleString()} rows from your workbook`,
      icon: FileSpreadsheet,
    },
    {
      label: "Mapping columns",
      description: `Preparing ${columnsCount} columns`,
      icon: Columns3,
    },
    {
      label: "Creating board",
      description: "Setting up your board structure",
      icon: Database,
    },
    {
      label: "Creating groups & tasks",
      description: "Importing your Excel data",
      icon: Layers3,
    },
    {
      label: "Finalizing board",
      description: "Almost there...",
      icon: Check,
    },
  ];

  const progress = Math.min(
    ((step + 1) / steps.length) * 100,
    100,
  );

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10">
      {/* Animated icon */}
      <div className="relative mb-7">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <FileSpreadsheet className="h-9 w-9" />
        </div>
      </div>

      <h2 className="text-xl font-bold tracking-tight">
        Creating your board
      </h2>

      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        We're importing your Excel data and building your board.
        Please don't close this window.
      </p>

      {/* Progress */}
      <div className="mt-8 w-full max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            Import progress
          </span>

          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="mt-8 w-full max-w-md space-y-2">
        {steps.map((item, index) => {
          const Icon = item.icon;

          const completed = index < step;
          const active = index === step;

          return (
            <div
              key={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                active
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                  completed
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-400 dark:bg-zinc-800"
                }`}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-semibold ${
                    active || completed
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </p>

                {(active || completed) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-7 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Rows3 className="h-3.5 w-3.5" />
        {rowsCount.toLocaleString()} rows

        <span>•</span>

        <Columns3 className="h-3.5 w-3.5" />
        {columnsCount} columns
      </div>
    </div>
  );
}

export function ExcelImportModal({
  file,
  onFileChange,
  onImport,
  defaultBoardName = "",
  defaultVisibility = "PRIVATE",
  disabled = false,
  isImporting = false,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [internalOpen, setInternalOpen] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    null,
  );

  const open =
    controlledOpen !== undefined
      ? controlledOpen
      : internalOpen;

  const setOpen = (value: boolean) => {
    // Don't allow the dialog to close while importing.
    if (isImporting && !value) {
      return;
    }

    if (controlledOpen === undefined) {
      setInternalOpen(value);
    }

    onOpenChange?.(value);
  };

  const {
    boardName,
    setBoardName,
    visibility,
    setVisibility,
    headers,
    rows,
    taskColumn,
    setTaskColumn,
    groupColumn,
    setGroupColumn,
    columnMappings,
    parseError,
    handleFileSelect,
    handleRemoveFile,
    handleMappingChange,
    handleImport,
    isReadyToImport,
  } = useExcelImport({
    file,
    defaultBoardName,
    defaultVisibility,
    onFileChange,
    onImport,
    setOpen,
  });

  /*
   * Create temporary browser preview URL.
   */
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  /*
   * Reset native input when dialog closes.
   */
  useEffect(() => {
    if (!open && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [open]);

  const previewFile =
    file && previewUrl
      ? {
          id: 0,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          url: previewUrl,
          uploadedById: 0,
          storageKey: "",
        }
      : null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && (
          <DialogTrigger asChild disabled={disabled}>
            {trigger}
          </DialogTrigger>
        )}

        <DialogContent
          className="max-h-[90vh] max-w-5xl! overflow-hidden p-0 z-[70]"
          overlayClassName="z-[70]"
          onInteractOutside={(event) => {
            if (isImporting) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (isImporting) {
              event.preventDefault();
            }
          }}
        >
          {/* Top gradient */}
          <div className="absolute top-0 right-0 left-0 z-10 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600" />

          {isImporting ? (
            <>
              {/* Importing Header */}
              <DialogHeader className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-bold">
                      Importing Excel
                    </DialogTitle>

                    <DialogDescription className="mt-1 text-xs">
                      Your board is being created...
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <ExcelImportProgress
                rowsCount={rows.length}
                columnsCount={headers.length}
              />
            </>
          ) : (
            <>
              {/* Normal Header */}
              <DialogHeader className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-bold">
                      Import from Excel
                    </DialogTitle>

                    <DialogDescription className="mt-1 text-xs">
                      Select an Excel workbook and configure
                      how its columns should be imported.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Content */}
              <div className="max-h-[calc(90vh-170px)] space-y-5 overflow-y-auto p-6">
                <ExcelFilePicker
                  file={file}
                  rowsCount={rows.length}
                  inputRef={inputRef}
                  previewFile={previewFile}
                  disabled={disabled}
                  isImporting={isImporting}
                  onSelect={handleFileSelect}
                  onPreview={() => setPreviewOpen(true)}
                  onChange={() => inputRef.current?.click()}
                  onRemove={handleRemoveFile}
                />

                {parseError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    {parseError}
                  </div>
                )}

                {file &&
                  headers.length > 0 &&
                  !parseError && (
                    <>
                      <ExcelImportSettings
                        boardName={boardName}
                        visibility={visibility}
                        isImporting={isImporting}
                        onBoardNameChange={setBoardName}
                        onVisibilityChange={setVisibility}
                      />

                      <ExcelTaskGroupSettings
                        headers={headers}
                        taskColumn={taskColumn}
                        groupColumn={groupColumn}
                        isImporting={isImporting}
                        onTaskColumnChange={setTaskColumn}
                        onGroupColumnChange={setGroupColumn}
                      />

                      <ExcelColumnMapping
                        mappings={columnMappings}
                        isImporting={isImporting}
                        onChange={handleMappingChange}
                      />

                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <Check className="h-4 w-4 shrink-0" />

                        <span>
                          {headers.length} column
                          {headers.length === 1 ? "" : "s"}{" "}
                          and {rows.length} row
                          {rows.length === 1 ? "" : "s"}{" "}
                          ready to import.
                        </span>
                      </div>
                    </>
                  )}
              </div>

              {/* Footer */}
              <DialogFooter className="mb-4 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isImporting}
                  className="h-9.5 border-gray-200 px-4 text-xs font-semibold hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  disabled={
                    !isReadyToImport ||
                    disabled ||
                    isImporting
                  }
                  onClick={handleImport}
                  loading={isImporting}
                  className="h-9.5 bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Import Excel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {previewFile && (
        <SingleFilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          file={previewFile}
        />
      )}
    </>
  );
}