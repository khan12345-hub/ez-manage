"use client";

import {
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  useBoardAutomations,
  useDeleteAutomation,
} from "../useAutomations";

import AutomationCard from "./AutomationCard";

type Props = {
  boardId: number;

  onEditAutomation?: (
    automationId: number,
  ) => void;
};

export default function AutomationManageTab({
  boardId,
  onEditAutomation,
}: Props) {
  const {
    data: automations = [],
    isLoading,
    isError,
  } = useBoardAutomations(boardId);

  const deleteMutation =
    useDeleteAutomation(boardId);

  const handleDelete = async (
    automationId: number,
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this automation?",
      );

    if (!confirmed) {
      return;
    }

    await deleteMutation.mutateAsync(
      automationId,
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />

          Loading automations...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-red-500">
          Failed to load automations.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b px-7">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-700">
            Your automations
          </h2>

          <p className="text-[12px] text-muted-foreground">
            {automations.length}{" "}
            {automations.length === 1
              ? "automation"
              : "automations"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-7 py-6">
        {automations.length === 0 ? (
          <EmptyAutomations />
        ) : (
          <div className="mx-auto max-w-[1000px] space-y-3">
            {automations.map(
              (automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={
                    automation
                  }
                  onEdit={() =>
                    onEditAutomation?.(
                      automation.id,
                    )
                  }
                  onDelete={() =>
                    handleDelete(
                      automation.id,
                    )
                  }
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables ===
                      automation.id
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyAutomations() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Settings2 className="h-5 w-5 text-blue-600" />
      </div>

      <h3 className="text-[15px] font-semibold text-slate-700">
        No automations yet
      </h3>

      <p className="mt-1 max-w-[350px] text-[13px] text-muted-foreground">
        Create an automation to
        automatically perform actions
        when something changes on
        this board.
      </p>
    </div>
  );
}