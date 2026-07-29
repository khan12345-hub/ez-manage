"use client";

import { useEffect, useState } from "react";

import {
  createStatusOption,
  deleteStatusOption,
  updateStatusOption,
} from "@/services/status-options.api";

import {
  StatusEditorMode,
  StatusOption,
  StatusValue,
} from "./status-options.types";

interface UseStatusEditorProps {
  statusOptions: StatusOption[];
  usedStatusValues?: StatusValue[];
  columnId: number;
  onSetValue: (
    value: StatusValue,
  ) => void;
  onSave: (
    value: StatusValue,
  ) => Promise<any>;
}

export function useStatusEditor({
  statusOptions,
  usedStatusValues = [],
  columnId,
  onSetValue,
  onSave,
}: UseStatusEditorProps) {
  const [mode, setMode] =
    useState<StatusEditorMode>(
      "picker",
    );

  const [statuses, setStatuses] =
    useState<StatusOption[]>(
      statusOptions,
    );

  const [open, setOpen] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

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

  const isStatusUsed = (
    status: StatusOption,
  ) => {
    if (status.isNew) {
      return false;
    }

    return usedStatusValues.some(
      (usedStatus) =>
        usedStatus.label ===
          status.label &&
        usedStatus.color ===
          status.color,
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

  const addLabel = () => {
    setStatuses((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: "New Label",
        color: "#c4c4c4",
        order:
          prev.length > 0
            ? Math.max(
                ...prev.map(
                  (status) =>
                    status.order,
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
          (item) =>
            item.id !== status.id,
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
          (item) =>
            item.id !== status.id,
        ),
      );
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
          statuses.map(
            async (status) => {
              if (status.isNew) {
                return createStatusOption(
                  columnId,
                  {
                    label:
                      status.label.trim(),
                    color:
                      status.color,
                  },
                );
              }

              return updateStatusOption(
                columnId,
                status.id,
                {
                  label:
                    status.label.trim(),
                  color:
                    status.color,
                },
              );
            },
          ),
        );

      const normalizedStatuses =
        savedStatuses.map(
          (status) => ({
            ...status,
            isNew: false,
          }),
        );

      setStatuses(
        normalizedStatuses,
      );

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

    updateLabel,
    updateColor,
    addLabel,
    removeLabel,
    selectStatus,
    applyChanges,
    isStatusUsed,
    handleOpenChange,
  };
}

