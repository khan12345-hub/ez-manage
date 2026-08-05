"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface StatusOption {
  id: string;
  label: string;
  color: string;
}

interface StatusColumn {
  id: number;
  name: string;
  options: StatusOption[];
}

interface BulkActionToolbarProps {
  selectedCount: number;
  statusColumns: StatusColumn[];

  onStatusChange: (
    columnId: number,
    value: {
      label: string;
      color: string;
    },
  ) => void;

  onDelete: () => void;
  onClear: () => void;

  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  statusColumns,
  onStatusChange,
  onDelete,
  onClear,
  isUpdating = false,
  isDeleting = false,
}: BulkActionToolbarProps) {
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [selectedStatusId, setSelectedStatusId] = useState("");

  const selectedColumn = statusColumns.find(
    (column) => String(column.id) === selectedColumnId,
  );

  useEffect(() => {
    if (selectedCount === 0) {
      setSelectedColumnId("");
      setSelectedStatusId("");
    }
  }, [selectedCount]);

  const handleColumnChange = (columnId: string) => {
    setSelectedColumnId(columnId);
    setSelectedStatusId("");
  };

  const handleStatusChange = (statusId: string) => {
    if (!selectedColumn) return;

    setSelectedStatusId(statusId);

    const option = selectedColumn.options.find(
      (status) => status.id === statusId,
    );

    if (!option) return;

    onStatusChange(selectedColumn.id, {
      label: option.label,
      color: option.color,
    });
  };

  const isBusy = isUpdating || isDeleting;

  return (
    <AnimatePresence initial={false}>
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
          <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
            <div className="flex min-h-14 items-center gap-4 px-4 py-2">
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
                {selectedCount} {selectedCount === 1 ? "task" : "tasks"}{" "}
                selected
              </motion.div>

              <Separator orientation="vertical" className="h-6" />

              <Select
                value={selectedColumnId}
                onValueChange={handleColumnChange}
                disabled={isBusy}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Status column" />
                </SelectTrigger>

                <SelectContent>
                  {statusColumns.map((column) => (
                    <SelectItem key={column.id} value={String(column.id)}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedStatusId}
                onValueChange={handleStatusChange}
                disabled={!selectedColumn || isBusy}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>

                <SelectContent>
                  {selectedColumn?.options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: option.color,
                          }}
                        />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}