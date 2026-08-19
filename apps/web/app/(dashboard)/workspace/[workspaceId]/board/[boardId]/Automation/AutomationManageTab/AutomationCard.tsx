"use client";

import {
  ArrowRight,
  GitBranch,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type { AutomationRule } from "@/services/automation.api";

type Props = {
  automation: AutomationRule;

  onEdit: () => void;

  onDelete: () => void;

  isDeleting?: boolean;
};

export default function AutomationCard({
  automation,
  onEdit,
  onDelete,
  isDeleting = false,
}: Props) {
  return (
    <div
      className="
        rounded-lg
        border
        bg-white
        p-4
        transition
        hover:border-slate-300
        hover:shadow-sm
      "
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
              <GitBranch className="h-3.5 w-3.5 text-blue-600" />
            </div>

            <h3 className="truncate text-[14px] font-medium text-slate-700">
              {automation.name}
            </h3>

            {!automation.isActive && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                Disabled
              </span>
            )}
          </div>

          {/* Rule */}
          <div className="mt-4 flex items-center gap-2 text-[13px]">
            <RuleBadge>
              Status changes
            </RuleBadge>

            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />

            <RuleBadge>
              Status #{automation.triggerStatusId}
            </RuleBadge>

            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />

            <RuleBadge>
              Move to group #
              {automation.targetGroupId}
            </RuleBadge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 px-2.5 text-xs"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={isDeleting}
            onClick={onDelete}
            className="
              h-8
              px-2.5
              text-xs
              text-red-600
              hover:bg-red-50
              hover:text-red-700
            "
          >
            {isDeleting ? (
              <span className="mr-1.5">
                Deleting...
              </span>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RuleBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-md border bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
      {children}
    </span>
  );
}