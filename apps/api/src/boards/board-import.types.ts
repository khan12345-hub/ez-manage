import { BoardColumnType } from 'generated/prisma/enums';

export type ImportedRow = Record<string, unknown>;

export type StatusOptionData = {
  label: string;
  color?: string;
};

export type StatusOption = {
  id: number;
  label: string;
  color: string;
};

export type StatusOptionMap = Map<string, StatusOption>;

export type GroupedRows = {
  name: string;
  color?: string;
  rows: ImportedRow[];
};

export type ColumnDefinition = {
  name: string;
  type: BoardColumnType;
  isPrimary: boolean;
};

