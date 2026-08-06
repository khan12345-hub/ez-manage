"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBulkAction, StatusColumn } from "./StatusBulkEditor";
import { useState } from "react";
import {
  BulkActionColumn,
  BulkColumnSelector,
} from "./BulkActionsColumnSelector";
import { DateBulkEditor } from "./DateBulkEditor";

interface BulkActionToolbarProps {
  selectedCount: number;
  columns: any;

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

  const statusColumns = (columns ?? [])
    .filter((column: any) => column.type === "STATUS")
    .map((column: any) => ({
      id: column.id,
      name: column.name,
      options: column.statusOptions ?? [],
    }));
  const [selectedColumn, setSelectedColumn] = useState<BulkActionColumn | null>(
    null,
  );

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
            <motion.div
              key={selectedCount}
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.16,
              }}
              className="whitespace-nowrap text-sm font-medium"
            >
              {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected
            </motion.div>
            <Separator orientation="vertical" className="h-6" />
            <BulkColumnSelector
              columns={columns}
              value={selectedColumn ? String(selectedColumn.id) : ""}
              disabled={isBusy}
              onChange={setSelectedColumn}
            />

            {selectedColumn?.type === "STATUS" && (
              <StatusBulkAction
                column={selectedColumn}
                onUpdate={onUpdate}
              />
            )}

            {/* {selectedColumn?.type === "DATE" && (
              <DateBulkEditor column={selectedColumn} />
            )} */}

            {/* {selectedColumn?.type === "TIMELINE" && (
              <TimelineBulkAction column={selectedColumn} />
            )}

            {selectedColumn?.type === "CHECKBOX" && (
              <CheckboxBulkAction column={selectedColumn} />
            )} */}
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
            <Separator orientation="vertical" className="h-6" />
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
