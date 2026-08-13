"use client";

import { Check, FilePlus2, LayoutTemplate } from "lucide-react";

import { cn } from "@/lib/utils";
import { BoardTemplate } from "@/app/(dashboard)/system-settings/board-template/template.types";


interface BoardTemplateSelectorProps {
  templates: BoardTemplate[];
  selectedTemplateId: number | null;
  onSelect: (templateId: number | null) => void;
  isLoading?: boolean;
}

export function BoardTemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  isLoading = false,
}: BoardTemplateSelectorProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-lg border bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto pr-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Blank board */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "relative flex min-h-28 flex-col items-start rounded-lg border p-4 text-left transition-all",
            selectedTemplateId === null
              ? "border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/30"
              : "border-gray-200 hover:border-cyan-300 hover:bg-gray-50 dark:border-zinc-800 dark:hover:border-cyan-800 dark:hover:bg-zinc-900",
          )}
        >
          {selectedTemplateId === null && (
            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white">
              <Check className="h-3 w-3" />
            </span>
          )}

          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
            <FilePlus2 className="h-4 w-4" />
          </div>

          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Blank board
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Start with an empty board.
          </p>
        </button>

        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className={cn(
                "relative flex min-h-28 flex-col items-start rounded-lg border p-4 text-left transition-all",
                isSelected
                  ? "border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/30"
                  : "border-gray-200 hover:border-cyan-300 hover:bg-gray-50 dark:border-zinc-800 dark:hover:border-cyan-800 dark:hover:bg-zinc-900",
              )}
            >
              {isSelected && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}

              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
                <LayoutTemplate className="h-4 w-4" />
              </div>

              <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                {template.name}
              </p>

              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-zinc-400">
                {template.description ||
                  `${template.groups?.length ?? 0} groups`}
              </p>
            </button>
          );
        })}
      </div>

      {!templates.length && (
        <div className="py-6 text-center text-xs text-gray-500 dark:text-zinc-400">
          No templates available for this workspace.
        </div>
      )}
    </div>
  );
}