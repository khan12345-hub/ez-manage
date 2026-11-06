"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  createStatusOption,
  deleteStatusOption,
  updateStatusOption,
} from "@/services/status-options.api";
import { suggestStatusCategory } from "@/lib/status-category";

import {
  StatusEditorMode,
  StatusOption,
  StatusValue,
} from "./status-options.types";

interface UseStatusEditorProps {
  statusOptions: StatusOption[];
  usedStatusValues?: StatusValue[];
  columnId: number;
  onSetValue: (value: StatusValue) => void;
  onSave: (value: StatusValue | null | undefined) => void;
}

export function useStatusEditor({
  statusOptions,
  usedStatusValues = [],
  columnId,
  onSetValue,
  onSave,
}: UseStatusEditorProps) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<StatusEditorMode>("picker");

  const [statuses, setStatuses] =
    useState<StatusOption[]>(statusOptions);

  const [open, setOpen] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatuses(statusOptions);
  }, [statusOptions]);

  const updateStatusInState = (
    id: number,
    changes: Partial<StatusOption>,
  ) => {
    setStatuses((prev) =>
      prev.map((status) =>
        status.id === id
          ? {
              ...status,
              ...changes,
            }
          : status,
      ),
    );
  };

  const isStatusUsed = (status: StatusOption) => {
    if (status.isNew) {
      return false;
    }

    return usedStatusValues.some(
      (usedStatus) =>
        usedStatus.label === status.label &&
        usedStatus.color === status.color,
    );
  };

  const updateLabel = (
    id: number,
    label: string,
  ) => {
    updateStatusInState(id, {
      label,
    });
  };

  const updateColor = (
    id: number,
    color: string,
  ) => {
    updateStatusInState(id, {
      color,
    });
  };

  /** Toggle "counts as done" for one option. Turning it off picks the label's non-done guess. */
  const toggleDone = (id: number) => {
    setStatuses((prev) =>
      prev.map((status) => {
        if (status.id !== id) return status;
        const isDone = (status.category ?? suggestStatusCategory(status.label)) === "DONE";
        const off = suggestStatusCategory(status.label);
        return {
          ...status,
          category: isDone ? (off === "DONE" ? "ACTIVE" : off) : "DONE",
          categoryTouched: true,
        };
      }),
    );
  };

  const addLabel = () => {
    setStatuses((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `New Label ${prev.length}`,
        color: "#c4c4c4",
        order:
          prev.length > 0
            ? Math.max(
                ...prev.map(
                  (status) => status.order,
                ),
              ) + 1000
            : 1000,
        isNew: true,
      },
    ]);
  };

  const removeLabel = async (
    status: StatusOption,
  ) => {
    if (status.isNew) {
      setStatuses((prev) =>
        prev.filter(
          (item) => item.id !== status.id,
        ),
      );

      return;
    }

    if (isStatusUsed(status)) {
      return;
    }

    try {
      await deleteStatusOption(
        columnId,
        status.id,
      );

      setStatuses((prev) =>
        prev.filter(
          (item) => item.id !== status.id,
        ),
      );

      await queryClient.invalidateQueries({
        queryKey: ["board"],
      });
    } catch (error) {
      console.error(
        "Failed to delete status option",
        error,
      );

      throw error;
    }
  };

  const selectStatus = async (
    status: StatusOption,
  ) => {
    const newValue: StatusValue = {
      label: status.label,
      color: status.color,
    };

    onSetValue(newValue);

    await onSave(newValue);

    setOpen(false);
    setMode("picker");
  };

  const applyChanges = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const savedStatuses =
        await Promise.all(
          statuses.map(async (status) => {
            if (status.isNew) {
              return createStatusOption(
                columnId,
                {
                  label:
                    status.label.trim(),
                  color: status.color,
                  ...(status.categoryTouched && status.category
                    ? { category: status.category }
                    : {}),
                },
              );
            }

            return updateStatusOption(
              columnId,
              status.id,
              {
                label:
                  status.label.trim(),
                color: status.color,
                ...(status.categoryTouched && status.category
                  ? { category: status.category }
                  : {}),
              },
            );
          }),
        );

      const normalizedStatuses =
        savedStatuses.map((status) => ({
          ...status,
          isNew: false,
        }));

      setStatuses(normalizedStatuses);

      await queryClient.invalidateQueries({
        queryKey: ["board"],
      });

      setMode("picker");

      return normalizedStatuses;
    } catch (error) {
      console.error(
        "Failed to update status options",
        error,
      );

      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (
    isOpen: boolean,
    isDragging?: boolean,
  ) => {
    if (isDragging) {
      return;
    }

    setOpen(isOpen);

    if (!isOpen) {
      setMode("picker");
    }
  };

  return {
    mode,
    statuses,
    open,
    isSaving,
    currentMode: mode,
    setMode,
    setOpen,
    setStatuses,
    updateLabel,
    updateColor,
    toggleDone,
    addLabel,
    removeLabel,
    selectStatus,
    applyChanges,
    isStatusUsed,
    handleOpenChange,
  };
}

