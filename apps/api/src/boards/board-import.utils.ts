import { BoardColumnType } from 'generated/prisma/enums';

import {
  GroupedRows,
  ImportedRow,
  StatusOptionData,
  StatusOptionMap,
} from './board-import.types';

/**
 * Normalize a value for reliable comparison.
 *
 * Examples:
 * "Task Name" -> "task name"
 * " task name " -> "task name"
 * "TASK_NAME" -> "task_name"
 */
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Check whether an imported Excel value is empty.
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
}

/**
 * Case-insensitive + whitespace-tolerant row lookup.
 */
export function getFlexibleValue(row: ImportedRow, keyName: string): unknown {
  if (!row || !keyName) {
    return undefined;
  }

  /**
   * Exact lookup first.
   */
  if (Object.prototype.hasOwnProperty.call(row, keyName)) {
    return row[keyName];
  }

  const targetKey = normalizeKey(keyName);

  /**
   * Case-insensitive lookup.
   */
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) === targetKey) {
      return value;
    }
  }

  /**
   * Whitespace normalization.
   *
   * "Task  Name"
   * "Task Name"
   *
   * become equivalent.
   */
  const compactTarget = targetKey.replace(/\s+/g, ' ');

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key).replace(/\s+/g, ' ');

    if (normalizedKey === compactTarget) {
      return value;
    }
  }

  return undefined;
}

/**
 * Convert parser values into a display string.
 *
 * Handles:
 * "Done"
 *
 * {
 *   label: "Done",
 *   color: "#00C875"
 * }
 */
export function extractDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    if ('label' in value && value.label !== null && value.label !== undefined) {
      return String(value.label).trim();
    }

    /**
     * Avoid storing "[object Object]" in cells.
     */
    return '';
  }

  return String(value).trim();
}

/**
 * Extract task name.
 */
export function getTaskName(rawValue: unknown, row?: ImportedRow): string {
  /**
   * Primary lookup.
   */
  const directValue = extractDisplayValue(rawValue);

  if (directValue) {
    return directValue;
  }

  /**
   * Fallback to common task/name columns.
   */
  if (row) {
    const preferredKeys = [
      'name',
      'task',
      'task name',
      'item',
      'item name',
      'title',
    ];

    for (const key of preferredKeys) {
      const value = getFlexibleValue(row, key);
      const extracted = extractDisplayValue(value);

      if (extracted) {
        return extracted;
      }
    }

    /**
     * Last fallback:
     * first non-metadata value.
     */
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith('__')) {
        continue;
      }

      const extracted = extractDisplayValue(value);

      if (extracted) {
        return extracted;
      }
    }
  }

  return '';
}

/**
 * Get unique status options from imported rows.
 */
export function getUniqueStatusOptions(
  rows: ImportedRow[],
  sourceColumn: string,
): StatusOptionData[] {
  const optionsMap = new Map<string, StatusOptionData>();

  for (const row of rows) {
    const rawValue = getFlexibleValue(row, sourceColumn);

    if (isEmptyValue(rawValue)) {
      continue;
    }

    let label = '';
    let color: string | undefined;

    if (
      typeof rawValue === 'object' &&
      rawValue !== null &&
      'label' in rawValue
    ) {
      label = String(rawValue.label ?? '').trim();

      if ('color' in rawValue && rawValue.color) {
        color = String(rawValue.color).trim();
      }
    } else {
      label = String(rawValue).trim();
    }

    if (!label) {
      continue;
    }

    const key = normalizeKey(label);

    if (!optionsMap.has(key)) {
      optionsMap.set(key, {
        label,
        color,
      });
    }
  }

  return Array.from(optionsMap.values());
}

/**
 * Normalize an imported cell value according to its board column type.
 */
export function normalizeCellValue(
  rawValue: unknown,
  columnType: BoardColumnType,
  sourceColumn: string,
  statusOptionsByColumn: Map<string, StatusOptionMap>,
): string | Record<string, string> | null {
  if (isEmptyValue(rawValue)) {
    return null;
  }

  /**
   * STATUS
   */
  if (columnType === BoardColumnType.STATUS) {
    const label = extractDisplayValue(rawValue);
    if (!label) {
      return null;
    }
    const columnOptions = statusOptionsByColumn.get(sourceColumn);
    /** * If status options were created successfully, * resolve the imported value to the actual * StatusOption. */ if (
      columnOptions
    ) {
      const matchedOption = columnOptions.get(normalizeKey(label));
      if (matchedOption) {
        return { label: matchedOption.label, color: matchedOption.color };
      }
    }
    /** * Fallback if the status option does not exist. */ if (
      typeof rawValue === 'object' &&
      rawValue !== null &&
      'label' in rawValue
    ) {
      const color =
        'color' in rawValue && rawValue.color
          ? String(rawValue.color)
          : undefined;
      return { label, ...(color ? { color } : {}) };
    }
    return { label, color: '#579BFC' };
  }
  /**
   * NUMBER
   */
  if (columnType === BoardColumnType.NUMBER) {
    return normalizeNumber(rawValue);
  }

  /**
   * DATE
   */
  if (columnType === BoardColumnType.DATE) {
    return normalizeDate(rawValue);
  }

  /**
   * CHECKBOX
   */
  if (columnType === BoardColumnType.CHECKBOX) {
    return normalizeBoolean(rawValue);
  }

  /**
   * Everything else.
   */
  return extractDisplayValue(rawValue) || null;
}

/**
 * Normalize checkbox values.
 */
export function normalizeBoolean(value: unknown): string {
  if (typeof value === 'boolean') {
    return String(value);
  }

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  return String(['true', 'yes', '1', 'checked', 'x', '✓'].includes(normalized));
}

/**
 * Normalize number values.
 */
export function normalizeNumber(value: unknown): string {
  if (typeof value === 'number') {
    return String(value);
  }

  const normalized = String(value ?? '')
    .replace(/,/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  const parsed = Number(normalized);

  return Number.isNaN(parsed) ? normalized : String(parsed);
}

/**
 * Normalize date values.
 */
export function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(String(value));

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return String(value).trim();
}

/**
 * Group imported rows using parser metadata.
 *
 * Supported metadata:
 * __groupName
 * __groupColor
 */
export function groupImportedRows(
  rows: ImportedRow[],
): Map<string, GroupedRows> {
  const groupedMap = new Map<string, GroupedRows>();

  for (const row of rows) {
    const rawGroupName = row.__groupName;

    const groupName =
      String(rawGroupName ?? 'Imported Tasks').trim() || 'Imported Tasks';

    const rawGroupColor = row.__groupColor;

    const groupColor =
      rawGroupColor !== null &&
      rawGroupColor !== undefined &&
      String(rawGroupColor).trim()
        ? String(rawGroupColor).trim()
        : undefined;

    const groupKey = normalizeKey(groupName);

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        name: groupName,
        color: groupColor,
        rows: [],
      });
    }

    groupedMap.get(groupKey)!.rows.push(row);
  }

  return groupedMap;
}

/**
 * Default status colors.
 */
export function getStatusColor(index: number): string {
  const colors = [
    '#579BFC',
    '#00C875',
    '#FDAB3D',
    '#E2445C',
    '#A25DDC',
    '#66CCFF',
  ];

  return colors[index % colors.length];
}

/**
 * Default group colors.
 */
export function getGroupColor(order: number): string {
  const colors = [
    '#579BFC',
    '#00C875',
    '#FDAB3D',
    '#E2445C',
    '#A25DDC',
    '#66CCFF',
  ];

  const index = Math.floor(order / 1000) - 1;

  return colors[index % colors.length];
}

/**
 * Legacy helper.
 *
 * Gets unique display values from an imported column.
 */
export function getUniqueColumnValues(
  rows: ImportedRow[],
  columnName: string,
): string[] {
  const values = new Set<string>();

  for (const row of rows) {
    const value = getFlexibleValue(row, columnName);

    if (isEmptyValue(value)) {
      continue;
    }

    const normalized = extractDisplayValue(value);

    if (normalized) {
      values.add(normalized);
    }
  }

  return Array.from(values);
}


