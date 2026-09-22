import type {
  BoardColumnType,
  ExcelColumnMappingDto,
} from "./excelImport.types";

/*
 * ============================================================================
 * VALUE-BASED DETECTORS
 * ============================================================================
 */

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/, // 2026-09-25 / ISO 8601
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // 09/25/2026 or 9-25-26
  /^\d{1,2}\s+\w{3,9}\s+\d{4}$/, // 25 September 2026
  /^\w{3,9}\s+\d{1,2},?\s+\d{4}$/, // September 25, 2026
];

const BOOLEAN_VALUES = new Set([
  "yes", "no", "true", "false", "1", "0",
  "done", "not done", "checked", "unchecked",
  "✓", "✗", "x", "on", "off",
]);

function getNonEmpty(values: unknown[]): string[] {
  return values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map((v) => String(v).trim());
}

function looksLikeDate(values: unknown[]): boolean {
  const nonEmpty = getNonEmpty(values);
  if (nonEmpty.length < 1) return false;
  const matches = nonEmpty.filter((v) =>
    DATE_PATTERNS.some((p) => p.test(v)),
  ).length;
  return matches / nonEmpty.length >= 0.7;
}

function looksLikeBoolean(values: unknown[]): boolean {
  const nonEmpty = getNonEmpty(values);
  if (nonEmpty.length < 1) return false;
  return nonEmpty.every((v) => BOOLEAN_VALUES.has(v.toLowerCase()));
}

/*
 * ============================================================================
 * NAME-BASED KEYWORD SETS
 * ============================================================================
 *
 * Match against the normalized (lowercase + trimmed) column header.
 * Exact words go in `exact`, substring matches go in `contains`.
 */

type NameRule = {
  exact?: string[];
  contains?: string[];
  type: BoardColumnType;
};

const NAME_RULES: NameRule[] = [
  /*
   * LINK — URL / website columns
   * Checked early so "url" beats TEXT fallback.
   */
  {
    exact: [
      "link", "links", "url", "urls", "website", "websites",
      "web", "href", "source", "reference", "ref", "site",
    ],
    contains: ["link", "url", "website"],
    type: "LINK",
  },

  /*
   * FILE_FEEDBACK — feedback/notes that attach directly to files, not the task drawer.
   * Columns like "Image Feedback", "File Notes", "Photo Review", "Asset Feedback".
   */
  {
    exact: [
      "feedback", "file feedback", "image feedback", "image notes",
      "file notes", "file comment", "file review", "asset feedback",
      "asset notes", "photo feedback", "photo notes", "attachment feedback",
    ],
    contains: ["file feedback", "image feedback", "file notes", "image notes", "asset feedback"],
    type: "FILE_FEEDBACK",
  },

  /*
   * LONG_TEXT — multi-line notes / descriptions (not comments)
   * Note/Remarks/Description are board columns, not task comments.
   */
  {
    exact: [
      "details", "detail", "info", "information",
      "body", "content", "summary", "about",
      "background", "context", "instructions",
      "note", "notes", "remark", "remarks",
      "description", "desc",
    ],
    contains: ["detail", "info", "description", "remark"],
    type: "LONG_TEXT",
  },

  /*
   * FILE — attachment / file upload columns
   */
  {
    exact: [
      "file", "files", "attachment", "attachments",
      "asset", "assets", "document", "documents", "media",
    ],
    type: "FILE",
  },

  /*
   * DATE — any time / calendar column
   */
  {
    exact: [
      "created", "updated", "modified", "scheduled",
      "start", "end", "finish", "delivery", "expiry",
      "expires", "due", "deadline",
    ],
    contains: [
      "date", "due", "deadline", "timeline",
      "schedule", "start date", "end date", "time",
    ],
    type: "DATE",
  },

  /*
   * CREATION_LOG — who created the task and when (Monday.com "Creation log" column).
   * Must come before PERSON to take precedence.
   */
  {
    exact: [
      "creation log", "creation_log", "created by", "created_by",
      "creator", "task creator", "created", "created by (log)",
    ],
    contains: ["creation log", "created by"],
    type: "CREATION_LOG",
  },

  /*
   * PERSON — people / assignee columns
   */
  {
    exact: [
      "person", "people", "assignee", "assignees",
      "owner", "owners", "assigned to", "contact", "contacts",
      "member", "members", "responsible", "reporter",
      "handler", "agent", "team member",
    ],
    contains: ["assignee", "owner"],
    type: "PERSON",
  },

  /*
   * CHECKBOX — boolean / done columns
   */
  {
    exact: [
      "done", "complete", "completed", "finished",
      "is done", "is complete", "confirmed", "approved",
    ],
    contains: ["checkbox"],
    type: "CHECKBOX",
  },

  /*
   * LABEL — category / tag columns
   */
  {
    exact: [
      "label", "labels", "tag", "tags",
      "category", "categories", "department",
    ],
    type: "LABEL",
  },

  /*
   * COMMENT — columns that represent person-attributed comments.
   * Only "comment/comments" (with or without a name suffix like
   * "Comments-Salman") go here. Notes/Remarks/Description go to
   * LONG_TEXT as board columns instead.
   */
  {
    exact: ["comment", "comments"],
    contains: ["comment"],
    type: "COMMENT",
  },

  /*
   * STATUS — status / workflow / priority columns
   *
   * NOTE: This rule is checked LAST among named rules so that
   * more-specific rules (DATE, PERSON, etc.) take precedence.
   */
  {
    exact: [
      "state", "stage", "phase", "priority", "urgency",
      "severity", "condition", "progress", "result", "outcome",
    ],
    contains: ["status", "priority"],
    type: "STATUS",
  },
];

/*
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

function detectByName(normalized: string): BoardColumnType | null {
  for (const rule of NAME_RULES) {
    if (rule.exact?.includes(normalized)) return rule.type;
    if (rule.contains?.some((kw) => normalized.includes(kw))) return rule.type;
  }
  return null;
}

/*
 * ============================================================================
 * PUBLIC API
 * ============================================================================
 */

export const getDefaultColumnType = (
  values: unknown[],
): BoardColumnType => {
  const nonEmpty = getNonEmpty(values);

  if (!nonEmpty.length) return "TEXT";

  // All look like URLs?
  const allUrls = nonEmpty.every((v) => /^https?:\/\//i.test(v) || /^www\./i.test(v));
  if (allUrls) return "LINK";

  // All numeric?
  const allNumbers = nonEmpty.every(
    (v) => typeof v === "number" || !Number.isNaN(Number(v)),
  );
  if (allNumbers) return "NUMBER";

  // All look like dates?
  if (looksLikeDate(values)) return "DATE";

  // All look like booleans?
  if (looksLikeBoolean(values)) return "CHECKBOX";

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

export const getDetectedTaskColumn = (headers: string[]): string => {
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
    const normalized = header.toLowerCase().trim();

    /*
     * 1. If ANY value in this column is a colored status object
     *    (Monday.com exports Status cells as { label, color }),
     *    treat it as STATUS regardless of header name.
     */
    const hasStatusObjects = values.some(
      (v) => typeof v === "object" && v !== null && "label" in v,
    );
    if (hasStatusObjects) {
      return { sourceColumn: header, targetColumn: header, type: "STATUS" };
    }

    /*
     * 2. Name-based detection (keyword rules).
     */
    const nameType = detectByName(normalized);
    if (nameType) {
      return { sourceColumn: header, targetColumn: header, type: nameType };
    }

    /*
     * 3. Value-based fallback (numbers, dates, booleans).
     */
    const type = getDefaultColumnType(values);

    return { sourceColumn: header, targetColumn: header, type };
  });
};
