"use client";

import { useEffect, useRef, useState } from "react";

import * as XLSX from "xlsx";

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

import { FileSpreadsheet, Upload, X, Check, ChevronDown } from "lucide-react";

import SingleFilePreviewModal from "@/app/(dashboard)/workspace/[workspaceId]/board/Cells/File/Previews/SingleFilePreviewModal";

type BoardColumnType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "PERSON"
  | "CHECKBOX"
  | "DROPDOWN"
  | "LABEL";

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: BoardColumnType;
}

export interface ExcelImportData {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
}

interface ExcelImportModalProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onImport: (data: ExcelImportData) => void | Promise<void>;
  defaultBoardName?: string;
  defaultVisibility?: "PUBLIC" | "PRIVATE";
  disabled?: boolean;
  isImporting?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const COLUMN_TYPES: {
  value: BoardColumnType;
  label: string;
}[] = [
  {
    value: "TEXT",
    label: "Text",
  },
  {
    value: "NUMBER",
    label: "Number",
  },
  {
    value: "DATE",
    label: "Date",
  },
  {
    value: "STATUS",
    label: "Status",
  },
  {
    value: "PERSON",
    label: "Person",
  },
  {
    value: "CHECKBOX",
    label: "Checkbox",
  },
  {
    value: "DROPDOWN",
    label: "Dropdown",
  },
  {
    value: "LABEL",
    label: "Label",
  },
];

const getDefaultColumnType = (values: unknown[]): BoardColumnType => {
  const nonEmptyValues = values.filter(
    (value) =>
      value !== null && value !== undefined && String(value).trim() !== "",
  );

  if (!nonEmptyValues.length) {
    return "TEXT";
  }

  const allNumbers = nonEmptyValues.every((value) => {
    return (
      typeof value === "number" ||
      (!Number.isNaN(Number(value)) && String(value).trim() !== "")
    );
  });

  if (allNumbers) {
    return "NUMBER";
  }

  return "TEXT";
};

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
}: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(value);
    }

    onOpenChange?.(value);
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [boardName, setBoardName] = useState(defaultBoardName);

  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(
    defaultVisibility,
  );

  const [headers, setHeaders] = useState<string[]>([]);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const [taskColumn, setTaskColumn] = useState("");
  const [groupColumn, setGroupColumn] = useState("");

  const [columnMappings, setColumnMappings] = useState<ExcelColumnMappingDto[]>(
    [],
  );

  const [parseError, setParseError] = useState<string | null>(null);

  /*
   * Keep board name synchronized
   * with the parent modal.
   */
  useEffect(() => {
    setBoardName(defaultBoardName);
  }, [defaultBoardName]);

  /*
   * Keep visibility synchronized
   * with the parent modal.
   */
  useEffect(() => {
    setVisibility(defaultVisibility);
  }, [defaultVisibility]);

  /*
   * Create temporary preview URL.
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
   * Reset native file input when dialog closes.
   */
  useEffect(() => {
    if (!open && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [open]);

  /*
   * Parse Excel whenever a new file is selected.
   */
  useEffect(() => {
    if (!file) {
      setHeaders([]);
      setRows([]);
      setTaskColumn("");
      setGroupColumn("");
      setColumnMappings([]);
      setParseError(null);
      return;
    }

    let cancelled = false;

    const parseExcel = async () => {
      try {
        setParseError(null);

        const arrayBuffer = await file.arrayBuffer();

        const workbook = XLSX.read(arrayBuffer, {
          type: "array",
          cellDates: true,
        });

        if (!workbook.SheetNames.length) {
          throw new Error("The Excel file does not contain any worksheets.");
        }

        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error("The Excel file does not contain any worksheets.");
        }

        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error("Unable to read the first worksheet.");
        }

        /*
         * Read the sheet as an array of arrays.
         */
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: "",
          raw: true,
        });

        if (!rawRows.length) {
          throw new Error("The Excel worksheet is empty.");
        }

        const headerRow = rawRows[0];

        if (!Array.isArray(headerRow)) {
          throw new Error("Unable to determine Excel column headers.");
        }

        const parsedHeaders = headerRow
          .map((header, index) => {
            const value = String(header ?? "").trim();

            return value || `Column ${index + 1}`;
          })
          .filter(Boolean);

        if (!parsedHeaders.length) {
          throw new Error(
            "The Excel worksheet does not contain column headers.",
          );
        }

        const dataRows = rawRows.slice(1).filter((row) => {
          if (!Array.isArray(row)) {
            return false;
          }

          return row.some(
            (value) =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== "",
          );
        });

        const parsedRows: Record<string, unknown>[] = dataRows.map((row) => {
          const record: Record<string, unknown> = {};

          parsedHeaders.forEach((header, index) => {
            record[header] = Array.isArray(row) ? (row[index] ?? "") : "";
          });

          return record;
        });

        if (cancelled) {
          return;
        }

        setHeaders(parsedHeaders);
        setRows(parsedRows);

        /*
         * Automatically identify task/group columns.
         */
        const normalizedHeaders = parsedHeaders.map((header) => ({
          original: header,
          normalized: header.toLowerCase().replace(/[\_-]/g, " ").trim(),
        }));

        const detectedTaskColumn =
          normalizedHeaders.find(
            ({ normalized }) =>
              normalized === "task" ||
              normalized === "tasks" ||
              normalized === "task name" ||
              normalized === "item" ||
              normalized === "item name" ||
              normalized === "name",
          )?.original ?? parsedHeaders[0];

        const detectedGroupColumn =
          normalizedHeaders.find(
            ({ normalized }) =>
              normalized === "group" ||
              normalized === "groups" ||
              normalized === "group name",
          )?.original ?? "";

        setTaskColumn(detectedTaskColumn);
        setGroupColumn(detectedGroupColumn);

        /*
         * Automatically create mappings for all columns.
         *
         * sourceColumn = Excel column
         * targetColumn = Board column
         */
        const mappings: ExcelColumnMappingDto[] = parsedHeaders.map(
          (header) => {
            const values = parsedRows.map((row) => row[header]);

            return {
              sourceColumn: header,
              targetColumn: header,
              type: getDefaultColumnType(values),
            };
          },
        );

        setColumnMappings(mappings);

        /*
         * Try to detect board name.
         */
        let detectedBoardName = "";

        for (const row of rawRows) {
          if (!Array.isArray(row)) {
            continue;
          }

          const firstCell = String(row[0] ?? "")
            .trim()
            .toLowerCase();

          if (firstCell === "board name" || firstCell === "board") {
            const value = String(row[1] ?? "").trim();

            if (value) {
              detectedBoardName = value;
              break;
            }
          }
        }

        /*
         * Fall back to filename.
         */
        if (!detectedBoardName) {
          detectedBoardName = file.name.replace(/\.(xlsx|xls)$/i, "").trim();
        }

        setBoardName(detectedBoardName);
      } catch (error) {
        console.error("Failed to parse Excel file:", error);

        if (!cancelled) {
          setParseError(
            error instanceof Error
              ? error.message
              : "Failed to read the Excel file.",
          );

          setHeaders([]);
          setRows([]);
          setTaskColumn("");
          setGroupColumn("");
          setColumnMappings([]);
        }
      }
    };

    void parseExcel();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleFileSelect = (selectedFile: File | undefined) => {
    if (!selectedFile) {
      return;
    }

    const isExcelFile =
      /\.(xlsx|xls)$/i.test(selectedFile.name) ||
      selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      selectedFile.type === "application/vnd.ms-excel";

    if (!isExcelFile) {
      setParseError("Please select a valid .xlsx or .xls file.");

      return;
    }

    setParseError(null);

    onFileChange(selectedFile);
  };

  const handleRemoveFile = () => {
    onFileChange(null);

    setHeaders([]);
    setRows([]);
    setTaskColumn("");
    setGroupColumn([]);
    setColumnMappings([]);
    setParseError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleMappingChange = (
    sourceColumn: string,
    field: "targetColumn" | "type",
    value: string,
  ) => {
    setColumnMappings((current) =>
      current.map((mapping) =>
        mapping.sourceColumn === sourceColumn
          ? {
              ...mapping,
              [field]: value,
            }
          : mapping,
      ),
    );
  };

  const handleImport = async () => {
    if (!file) {
      return;
    }

    if (!boardName.trim()) {
      setParseError("Board name is required.");
      return;
    }

    if (!headers.length) {
      setParseError("No columns were found in the Excel file.");
      return;
    }

    if (!rows.length) {
      setParseError("The Excel file does not contain any data rows.");
      return;
    }

    if (!taskColumn) {
      setParseError("Please select the task column.");
      return;
    }

    try {
      await onImport({
        boardName: boardName.trim(),
        visibility,
        taskColumn,
        groupColumn: groupColumn || undefined,
        columns: columnMappings,
        rows,
      });

      setOpen(false);
    } catch (error) {
      console.error("Excel import failed:", error);
    }
  };

  /*
   * Adapt browser File into the shape expected
   * by SingleFilePreviewModal.
   */
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

  const isReadyToImport =
    Boolean(file) &&
    Boolean(boardName.trim()) &&
    Boolean(taskColumn) &&
    headers.length > 0 &&
    rows.length > 0 &&
    columnMappings.length > 0 &&
    !parseError;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && (
          <DialogTrigger asChild disabled={disabled}>
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
                  Select an Excel workbook and configure how its columns should
                  be imported.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(90vh-170px)] space-y-5 overflow-y-auto p-6">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                handleFileSelect(event.target.files?.[0]);
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
                        setPreviewOpen(true);
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
                      {rows.length
                        ? `${rows.length} row${rows.length === 1 ? "" : "s"}`
                        : "Reading file..."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isImporting}
                    className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
                  >
                    Change
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isImporting}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800"
                    aria-label="Remove Excel file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {parseError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                {parseError}
              </div>
            )}

            {file && headers.length > 0 && !parseError && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Board Name</label>

                    <input
                      value={boardName}
                      onChange={(event) => setBoardName(event.target.value)}
                      disabled={isImporting}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                      placeholder="Board name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visibility</label>

                    <select
                      value={visibility}
                      onChange={(event) =>
                        setVisibility(
                          event.target.value as "PUBLIC" | "PRIVATE",
                        )
                      }
                      disabled={isImporting}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="PRIVATE">Private</option>

                      <option value="PUBLIC">Public</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold">Task & Group</h3>

                    <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                      Select which Excel columns contain your tasks and groups.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Task Column</label>

                      <div className="relative">
                        <select
                          value={taskColumn}
                          onChange={(event) =>
                            setTaskColumn(event.target.value)
                          }
                          disabled={isImporting}
                          className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white px-3 pr-8 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <option value="">Select task column</option>

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
                            setGroupColumn(event.target.value)
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

                <div className="rounded-xl border border-gray-200 dark:border-zinc-800">
                  <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold">Column Mapping</h3>

                    <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                      Configure how each Excel column should be created on the
                      board.
                    </p>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {columnMappings.map((mapping, index) => (
                      <div
                        key={mapping.sourceColumn}
                        className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3 ${
                          index !== columnMappings.length - 1
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
                              handleMappingChange(
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
                              handleMappingChange(
                                mapping.sourceColumn,
                                "type",
                                event.target.value,
                              )
                            }
                            disabled={isImporting}
                            className="h-8 w-24 shrink-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            {COLUMN_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" />

                  <span>
                    {headers.length} column
                    {headers.length === 1 ? "" : "s"} and {rows.length} row
                    {rows.length === 1 ? "" : "s"} ready to import.
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
              disabled={!isReadyToImport || disabled || isImporting}
              onClick={handleImport}
              loading={isImporting}
              className="h-9.5 bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Import Excel"}
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
