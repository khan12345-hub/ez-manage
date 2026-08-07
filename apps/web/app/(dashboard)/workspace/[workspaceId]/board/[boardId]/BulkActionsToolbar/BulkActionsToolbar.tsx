"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  StatusBulkAction,
  StatusColumn,
} from "./StatusBulkEditor";

import {
  BulkActionColumn,
  BulkColumnSelector,
} from "./BulkActionsColumnSelector";

import { DateBulkEditor } from "./DateBulkEditor";
import { TimelineBulkAction } from "./TimelineBulkEditor";
import { CheckboxBulkAction } from "./CheckboxBulkEditor";

interface BulkActionToolbarProps {
  selectedCount: number;
  columns: BulkActionColumn[];

  onUpdate: (columnId: number, value: any) => void;

  onDelete: () => void;
  onClear: () => void;

  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  columns,
  onUpdate,
  onDelete,
  onClear,
  isUpdating = false,
  isDeleting = false,
}: BulkActionToolbarProps) {
  const isBusy = isUpdating || isDeleting;

  const [selectedColumn, setSelectedColumn] =
    useState<BulkActionColumn | null>(null);

  const [pendingValue, setPendingValue] =
    useState<any>(null);

  useEffect(() => {
    if (selectedCount === 0) {
      setSelectedColumn(null);
      setPendingValue(null);
    }
  }, [selectedCount]);

  const handleColumnChange = (
    column: BulkActionColumn,
  ) => {
    setSelectedColumn(column);

    // Clear previous value when switching columns
    setPendingValue(null);
  };

  const handleApply = () => {
    if (!selectedColumn || pendingValue === null) {
      return;
    }

    onUpdate(selectedColumn.id, pendingValue);
  };

  const canApply =
    selectedColumn !== null &&
    pendingValue !== null &&
    !isBusy;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{
            opacity: 0,
            y: -24,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: -16,
            scale: 0.98,
          }}
          transition={{
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 px-6 py-4"
        >
          <div className="flex items-center gap-4 rounded-2xl border bg-background/95 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <div className="whitespace-nowrap text-sm font-medium">
              {selectedCount}{" "}
              {selectedCount === 1 ? "task" : "tasks"} selected
            </div>

            <Separator
              orientation="vertical"
              className="h-6"
            />

            <BulkColumnSelector
              columns={columns}
              value={
                selectedColumn
                  ? String(selectedColumn.id)
                  : ""
              }
              disabled={isBusy}
              onChange={handleColumnChange}
            />

            {selectedColumn?.type === "STATUS" && (
              <StatusBulkAction
                column={selectedColumn}
                disabled={isBusy}
                onChange={setPendingValue}
              />
            )}

            {selectedColumn?.type === "DATE" && (
              <DateBulkEditor
                column={selectedColumn}
                disabled={isBusy}
                onChange={setPendingValue}
              />
            )}

            {selectedColumn?.type === "TIMELINE" && (
              <TimelineBulkAction
                column={selectedColumn}
                disabled={isBusy}
                onChange={setPendingValue}
              />
            )}

            {selectedColumn?.type === "CHECKBOX" && (
              <CheckboxBulkAction
                column={selectedColumn}
                disabled={isBusy}
                onChange={setPendingValue}
              />
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!canApply}
              className="h-9"
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}

              {isUpdating ? "Applying..." : "Apply"}
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isBusy}
              className="h-9"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}

              {isDeleting ? "Deleting..." : "Delete"}
            </Button>

            <Separator
              orientation="vertical"
              className="h-6"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClear}
              disabled={isBusy}
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}