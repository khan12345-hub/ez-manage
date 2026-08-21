"use client";

import { useEffect, useMemo, useState } from "react";

import { extractExcelBoard } from "./excelParser";

import type {
  BoardColumnType,
  ExcelColumnMappingDto,
  ExcelImportData,
} from "./excelImport.types";

import {
  buildColumnMappings,
  getDetectedTaskColumn,
  isExcelFile,
} from "./excelImport.utils";

interface UseExcelImportOptions {
  file: File | null;
  defaultBoardName: string;
  defaultVisibility: "PUBLIC" | "PRIVATE";
  onFileChange: (file: File | null) => void;
  onImport: (data: ExcelImportData) => void | Promise<void>;
  setOpen: (open: boolean) => void;
}

export function useExcelImport({
  file,
  defaultBoardName,
  defaultVisibility,
  onFileChange,
  onImport,
  setOpen,
}: UseExcelImportOptions) {
  const [boardName, setBoardName] =
    useState(defaultBoardName);

  const [visibility, setVisibility] =
    useState<"PUBLIC" | "PRIVATE">(defaultVisibility);

  const [headers, setHeaders] = useState<string[]>([]);

  const [rows, setRows] = useState<
    Record<string, unknown>[]
  >([]);

  const [taskColumn, setTaskColumn] = useState("");

  const [groupColumn, setGroupColumn] = useState("");

  const [columnMappings, setColumnMappings] = useState<
    ExcelColumnMappingDto[]
  >([]);

  const [parseError, setParseError] =
    useState<string | null>(null);

  useEffect(() => {
    setBoardName(defaultBoardName);
  }, [defaultBoardName]);

  useEffect(() => {
    setVisibility(defaultVisibility);
  }, [defaultVisibility]);

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

        const parsedData = await extractExcelBoard(file);

        if (cancelled) {
          return;
        }

        if (!parsedData.columns.length) {
          throw new Error(
            "No valid columns were found in the Excel worksheet.",
          );
        }

        if (!parsedData.rows.length) {
          throw new Error(
            "The Excel worksheet does not contain any data rows.",
          );
        }

        const parsedHeaders = parsedData.columns.map(
          (column:any) => column.name,
        );

        const parsedRows =
          parsedData.rows as Record<string, unknown>[];

        setHeaders(parsedHeaders);
        setRows(parsedRows);

        setBoardName(
          parsedData.boardName || defaultBoardName,
        );

        const detectedTaskColumn =
          getDetectedTaskColumn(parsedHeaders);

        setTaskColumn(detectedTaskColumn);

        /*
         * Groups are extracted by the custom parser.
         * The backend/parser metadata uses __groupName.
         */
        setGroupColumn("__groupName");

        const mappings = buildColumnMappings(
          parsedHeaders,
          parsedRows,
        );

        setColumnMappings(mappings);
      } catch (error) {
        console.error(
          "Failed to parse Excel file:",
          error,
        );

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
  }, [file, defaultBoardName]);

  const handleFileSelect = (
    selectedFile: File | undefined,
  ) => {
    if (!selectedFile) {
      return;
    }

    if (!isExcelFile(selectedFile)) {
      setParseError(
        "Please select a valid .xlsx or .xls file.",
      );
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
    setGroupColumn("");
    setColumnMappings([]);
    setParseError(null);
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
              [field]:
                field === "type"
                  ? (value as BoardColumnType)
                  : value,
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
      setParseError(
        "No columns were found in the Excel file.",
      );
      return;
    }

    if (!rows.length) {
      setParseError(
        "The Excel file does not contain any data rows.",
      );
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

  const isReadyToImport = useMemo(
    () =>
      Boolean(file) &&
      Boolean(boardName.trim()) &&
      Boolean(taskColumn) &&
      headers.length > 0 &&
      rows.length > 0 &&
      columnMappings.length > 0 &&
      !parseError,
    [
      file,
      boardName,
      taskColumn,
      headers.length,
      rows.length,
      columnMappings.length,
      parseError,
    ],
  );

  return {
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

    setParseError,

    handleFileSelect,
    handleRemoveFile,
    handleMappingChange,
    handleImport,

    isReadyToImport,
  };
}