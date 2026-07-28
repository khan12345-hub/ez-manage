"use client";

import { useMemo, useState } from "react";

import { PersonValue } from "../../../Cells/Person/PersonPicker";

interface Props {
  columns: any[];
  groups?: any[];
}

export function useBoardFilters({
  columns,
}: Props) {
  const [
    hideColumnOpen,
    setHideColumnOpen,
  ] = useState(false);

  const [
    hiddenColumnIds,
    setHiddenColumnIds,
  ] = useState<number[]>([]);

  const [
    personFilter,
    setPersonFilter,
  ] = useState<PersonValue | null>(null);

  const hideableColumns = useMemo(() => {
    return columns.filter(
      (column: any) =>
        !column.isPrimary,
    );
  }, [columns]);

  const openHideColumnModal = () => {
    setHideColumnOpen(true);
  };

  const toggleColumn = (
    id: number,
  ) => {
    setHiddenColumnIds((prev) =>
      prev.includes(id)
        ? prev.filter(
            (columnId) =>
              columnId !== id,
          )
        : [...prev, id],
    );
  };

  const toggleAllColumns = (
    checked: boolean,
  ) => {
    if (checked) {
      setHiddenColumnIds([]);
      return;
    }

    setHiddenColumnIds(
      hideableColumns.map(
        (column: any) =>
          column.id,
      ),
    );
  };

  const filteredColumns = useMemo(() => {
    return columns.filter(
      (column: any) =>
        !hiddenColumnIds.includes(
          column.id,
        ),
    );
  }, [
    columns,
    hiddenColumnIds,
  ]);

  const allColumnsHidden =
    hideableColumns.length > 0 &&
    hideableColumns.every(
      (column: any) =>
        hiddenColumnIds.includes(
          column.id,
        ),
    );

  const allColumnsVisible =
    hideableColumns.length === 0 ||
    hideableColumns.every(
      (column: any) =>
        !hiddenColumnIds.includes(
          column.id,
        ),
    );

  const selectedPersonIds =
    personFilter?.users.map(
      (user) => user.id,
    ) ?? [];

  return {
    hideColumnOpen,
    setHideColumnOpen,

    openHideColumnModal,

    hiddenColumnIds,
    hideableColumns,

    filteredColumns,

    toggleColumn,
    toggleAllColumns,

    allColumnsHidden,
    allColumnsVisible,

    personFilter,
    setPersonFilter,
    selectedPersonIds,
  };
}