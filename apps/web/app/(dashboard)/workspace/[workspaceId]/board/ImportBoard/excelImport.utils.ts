import type {
  BoardColumnType,
  ExcelColumnMappingDto,
} from "./excelImport.types";

export const getDefaultColumnType = (
  values: unknown[],
): BoardColumnType => {
  const nonEmptyValues = values.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== "",
  );

  if (!nonEmptyValues.length) {
    return "TEXT";
  }

  const allNumbers = nonEmptyValues.every((value) => {
    return (
      typeof value === "number" ||
      (!Number.isNaN(Number(value)) &&
        String(value).trim() !== "")
    );
  });

  if (allNumbers) {
    return "NUMBER";
  }

  return "TEXT";
};

export const isExcelFile = (file: File): boolean => {
  return (
    /\.(xlsx|xls)$/i.test(file.name) ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
};

export const getDetectedTaskColumn = (
  headers: string[],
): string => {
  return (
    headers.find((header) => {
      const normalized = header.toLowerCase().trim();

      return (
        normalized === "name" ||
        normalized === "task" ||
        normalized === "tasks" ||
        normalized === "task name" ||
        normalized === "item" ||
        normalized === "item name"
      );
    }) ?? headers[0] ?? ""
  );
};

export const buildColumnMappings = (
  headers: string[],
  rows: Record<string, unknown>[],
): ExcelColumnMappingDto[] => {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);

    const hasStatusObjects = values.some(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "label" in value,
    );

    const type =
      hasStatusObjects ||
      header.toLowerCase().includes("status")
        ? "STATUS"
        : getDefaultColumnType(values);

    return {
      sourceColumn: header,
      targetColumn: header,
      type,
    };
  });
};