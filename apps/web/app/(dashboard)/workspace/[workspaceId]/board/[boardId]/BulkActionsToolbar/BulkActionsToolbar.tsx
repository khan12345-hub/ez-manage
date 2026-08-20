"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

import { StatusBulkAction } from "./StatusBulkEditor";
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

  /**
   * Optional group name.
   * If the selected tasks belong to a group,
   * it will be displayed in the confirmation dialog.
   */
  groupName?: string;

  onUpdate: (
    columnId: number,
    value: any,
  ) => void;

  onDelete: () => void;
  onClear: () => void;

  isUpdating?: boolean;
  isDeleting?: boolean;
}

type PendingAction =
  | {
      type: "update";
      columnId: number;
      value: any;
    }
  | {
      type: "delete";
    }
  | null;

export function BulkActionToolbar({
  selectedCount,
  columns,
  groupName,
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

  const [pendingAction, setPendingAction] =
    useState<PendingAction>(null);

  const [confirmationOpen, setConfirmationOpen] =
    useState(false);

  useEffect(() => {
    if (selectedCount === 0) {
      setSelectedColumn(null);
      setPendingValue(null);
      setPendingAction(null);
      setConfirmationOpen(false);
    }
  }, [selectedCount]);

  const handleColumnChange = (
    column: BulkActionColumn,
  ) => {
    setSelectedColumn(column);

    // Clear previous value when switching columns.
    setPendingValue(null);
  };

  /**
   * Open confirmation before applying a bulk update.
   */
  const handleApply = () => {
    if (
      !selectedColumn ||
      pendingValue === null ||
      isBusy
    ) {
      return;
    }

    setPendingAction({
      type: "update",
      columnId: selectedColumn.id,
      value: pendingValue,
    });

    setConfirmationOpen(true);
  };

  /**
   * Open confirmation before deleting tasks.
   */
  const handleDelete = () => {
    if (isBusy) {
      return;
    }

    setPendingAction({
      type: "delete",
    });

    setConfirmationOpen(true);
  };

  /**
   * Actually perform the action after confirmation.
   */
  const handleConfirmAction = () => {
    if (!pendingAction) {
      return;
    }

    setConfirmationOpen(false);

    if (pendingAction.type === "delete") {
      onDelete();
    } else {
      onUpdate(
        pendingAction.columnId,
        pendingAction.value,
      );
    }

    setPendingAction(null);
  };

  const handleConfirmationChange = (
    open: boolean,
  ) => {
    setConfirmationOpen(open);

    if (!open) {
      setPendingAction(null);
    }
  };

  const canApply =
    selectedColumn !== null &&
    pendingValue !== null &&
    !isBusy;

  const taskLabel =
    selectedCount === 1 ? "task" : "tasks";

  const groupText = groupName
    ? ` in "${groupName}"`
    : "";

  /**
   * Confirmation content for update.
   */
  const updateDescription = selectedColumn ? (
    <>
      This will update the{" "}
      <span className="font-medium text-foreground">
        {selectedColumn.name}
      </span>{" "}
      field for{" "}
      <span className="font-medium text-foreground">
        {selectedCount} {taskLabel}
      </span>
      {groupName && (
        <>
          {" "}
          in{" "}
          <span className="font-medium text-foreground">
            "{groupName}"
          </span>
        </>
      )}
      .
    </>
  ) : (
    ""
  );

  /**
   * Confirmation content for deletion.
   */
  const deleteDescription = (
    <>
      Are you sure you want to delete{" "}
      <span className="font-medium text-foreground">
        {selectedCount} {taskLabel}
      </span>
      {groupName && (
        <>
          {" "}
          from{" "}
          <span className="font-medium text-foreground">
            "{groupName}"
          </span>
        </>
      )}
      ?
      <br />
      <br />
      This will permanently delete the selected{" "}
      {taskLabel}, including their{" "}
      <span className="font-medium text-foreground">
        files and comments
      </span>
      . This action cannot be undone.
    </>
  );

  const isDeleteConfirmation =
    pendingAction?.type === "delete";

  return (
    <>
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
                {selectedCount} {taskLabel} selected
                {groupName && (
                  <span className="ml-1 text-muted-foreground">
                    in {groupName}
                  </span>
                )}
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

                {isUpdating
                  ? "Applying..."
                  : "Apply"}
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isBusy}
                className="h-9"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}

                {isDeleting
                  ? "Deleting..."
                  : "Delete"}
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

      <DeleteConfirmationDialog
        open={confirmationOpen}
        onOpenChange={handleConfirmationChange}
        onConfirm={handleConfirmAction}
        isDeleting={isUpdating || isDeleting}
        title={
          isDeleteConfirmation
            ? `Delete ${selectedCount} ${taskLabel}${groupText}?`
            : `Update ${selectedCount} ${taskLabel}${groupText}?`
        }
        description={
          isDeleteConfirmation
            ? deleteDescription
            : updateDescription
        }
        confirmLabel={
          isDeleteConfirmation
            ? "Delete"
            : "Apply"
        }
        deletingLabel={
          isDeleteConfirmation
            ? "Deleting..."
            : "Applying..."
        }
      />
    </>
  );
}