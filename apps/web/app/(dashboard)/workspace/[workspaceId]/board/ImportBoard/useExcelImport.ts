"use client";

import { useEffect, useMemo, useState } from "react";

import { extractExcelBoard, parseSheet2Comments } from "./excelParser";

import type {
  BoardColumnType,
  ExcelColumnMappingDto,
  ExcelImportData,
  ImportedComment,
  UserToCreate,
} from "./excelImport.types";

import {
  buildColumnMappings,
  getDetectedTaskColumn,
  isExcelFile,
} from "./excelImport.utils";

/** Split a raw display name into firstName / lastName best-effort. */
function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

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

  const [comments, setComments] = useState<ImportedComment[]>([]);

  const [usersToCreate, setUsersToCreate] = useState<UserToCreate[]>([]);

  const [parseError, setParseError] = useState<string | null>(null);

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
      setComments([]);
      setUsersToCreate([]);
      setParseError(null);
      return;
    }

    let cancelled = false;

    const parseExcel = async () => {
      try {
        setParseError(null);

        const [parsedData, parsedComments] = await Promise.all([
          extractExcelBoard(file),
          parseSheet2Comments(file),
        ]);

        console.log("========== EXTRACTED DATA FROM PARSER ==========");

        console.log("TASK COLUMN:", parsedData.taskColumn);

        console.log("FIRST ROW:", parsedData.rows[0]);

        console.log("ALL ROWS:", JSON.stringify(parsedData.rows, null, 2));

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
          (column: any) => column.name,
        );

        const parsedRows = parsedData.rows as Record<string, unknown>[];

        setHeaders(parsedHeaders);
        setRows(parsedRows);
        setComments(parsedComments);

        setBoardName(parsedData.boardName || defaultBoardName);

        const detectedTaskColumn =
          parsedData.taskColumn || getDetectedTaskColumn(parsedHeaders);

        setTaskColumn(detectedTaskColumn);

        /*
         * Groups are extracted by the custom parser.
         * The backend/parser metadata uses __groupName.
         */
        setGroupColumn("__groupName");

        const mappings = buildColumnMappings(parsedHeaders, parsedRows);

        setColumnMappings(mappings);
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
          setComments([]);
          setUsersToCreate([]);
        }
      }
    };

    void parseExcel();

    return () => {
      cancelled = true;
    };
  }, [file, defaultBoardName]);

  const handleFileSelect = (selectedFile: File | undefined) => {
    if (!selectedFile) {
      return;
    }

    if (!isExcelFile(selectedFile)) {
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
    setGroupColumn("");
    setColumnMappings([]);
    setComments([]);
    setUsersToCreate([]);
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
              [field]: field === "type" ? (value as BoardColumnType) : value,
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

    console.log("========== FINAL IMPORT DATA ==========");

    console.log({
      boardName: boardName.trim(),
      visibility,
      taskColumn,
      groupColumn: groupColumn || undefined,
      columns: columnMappings,
      rows,
    });

    console.log("FIRST FINAL ROW:", rows[0]);

    console.log("========== IMPORT PAYLOAD ==========");
    const importPayload = {
      boardName: boardName.trim(),
      visibility,
      taskColumn,
      groupColumn: groupColumn || undefined,
      columns: columnMappings,
      rows,
    };
    console.log(JSON.stringify(importPayload, null, 2));
    console.log("====================================");
    // Only send users that the operator opted in to create and have an email.
    const usersPayload = usersToCreate
      .filter((u) => u.include && u.email.trim() && u.firstName.trim())
      .map(({ firstName, lastName, email, workspaceRole, boardRole }) => ({
        firstName,
        lastName,
        email,
        workspaceRole,
        boardRole,
      }));

    try {
      await onImport({
        boardName: boardName.trim(),
        visibility,
        taskColumn,
        groupColumn: groupColumn || undefined,
        columns: columnMappings,
        rows,
        comments: comments.length > 0 ? comments : undefined,
        usersToCreate: usersPayload.length > 0 ? usersPayload : undefined,
      });

      setOpen(false);
    } catch (error) {
      console.error("Excel import failed:", error);
    }
  };

  // Unique person tokens from all PERSON-typed column mappings.
  // Seeded into the People step so the user can fill in emails and roles.
  const unresolvedPersonTokens = useMemo<UserToCreate[]>(() => {
    const personColumns = columnMappings
      .filter((m) => m.type === "PERSON")
      .map((m) => m.sourceColumn);

    if (!personColumns.length || !rows.length) return [];

    const seen = new Set<string>();
    const result: UserToCreate[] = [];

    for (const col of personColumns) {
      for (const row of rows) {
        const cell = row[col];
        if (!cell) continue;
        const raw = typeof cell === "object" && cell !== null && "label" in cell
          ? String((cell as Record<string, unknown>).label ?? "")
          : String(cell);
        const tokens = raw.split(/,\s*/).map((t) => t.trim()).filter(Boolean);
        for (const token of tokens) {
          const key = token.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const { firstName, lastName } = splitName(token);
          // Auto-detect email-format tokens — treat them as email field.
          const looksLikeEmail = token.includes("@");
          result.push({
            rawName: token,
            firstName: looksLikeEmail ? "" : firstName,
            lastName: looksLikeEmail ? "" : lastName,
            email: looksLikeEmail ? token : "",
            workspaceRole: "MEMBER",
            boardRole: "MEMBER",
            include: false,
          });
        }
      }
    }

    return result;
  }, [columnMappings, rows]);

  // Keep usersToCreate in sync when column mappings or rows change.
  // Preserve existing edits (by rawName) so the user doesn't lose typed emails.
  useEffect(() => {
    setUsersToCreate((prev) => {
      const prevByKey = new Map(prev.map((u) => [u.rawName.toLowerCase(), u]));
      return unresolvedPersonTokens.map((token) => {
        const existing = prevByKey.get(token.rawName.toLowerCase());
        return existing ?? token;
      });
    });
  }, [unresolvedPersonTokens]);

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
    comments,

    taskColumn,
    setTaskColumn,

    groupColumn,
    setGroupColumn,

    columnMappings,

    usersToCreate,
    setUsersToCreate,

    parseError,

    setParseError,

    handleFileSelect,
    handleRemoveFile,
    handleMappingChange,
    handleImport,

    isReadyToImport,
  };
}
