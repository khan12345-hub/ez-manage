"use client";

import { useEffect, useRef, useState } from "react";

import {
  Check,
  FileSpreadsheet,
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

import type {
  ExcelImportProps,
} from "./excelImport.types";

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
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [internalOpen, setInternalOpen] =
    useState(false);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const open =
    controlledOpen !== undefined
      ? controlledOpen
      : internalOpen;

  const setOpen = (value: boolean) => {
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
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        {trigger && (
          <DialogTrigger
            asChild
            disabled={disabled}
          >
            {trigger}
          </DialogTrigger>
        )}

        <DialogContent className="max-h-[90vh] max-w-5xl! overflow-hidden p-0">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600" />

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
              onChange={() =>
                inputRef.current?.click()
              }
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
                    onTaskColumnChange={
                      setTaskColumn
                    }
                    onGroupColumnChange={
                      setGroupColumn
                    }
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
                      {headers.length === 1
                        ? ""
                        : "s"}{" "}
                      and {rows.length} row
                      {rows.length === 1 ? "" : "s"}{" "}
                      ready to import.
                    </span>
                  </div>
                </>
              )}
          </div>

          <DialogFooter className="border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
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
              {isImporting
                ? "Importing..."
                : "Import Excel"}
            </Button>
          </DialogFooter>
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