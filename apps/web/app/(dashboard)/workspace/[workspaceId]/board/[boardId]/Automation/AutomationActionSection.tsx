"use client";

import type { AutomationActionType } from "./automation.actions";
import { AUTOMATION_ACTIONS } from "./automation.actions";

type AutomationActionSectionProps = {
  title: string;

  actions: typeof AUTOMATION_ACTIONS;

  onSelect: (
    action: AutomationActionType,
  ) => void;
};

export default function AutomationActionSection({
  title,
  actions,
  onSelect,
}: AutomationActionSectionProps) {
  return (
    <div className="mb-2">
      <div
        className="
          mb-1
          px-1
          text-xs
          font-medium
          text-slate-500
        "
      >
        {title}
      </div>

      <div className="space-y-0.5">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.value}
              type="button"
              onClick={() =>
                onSelect(action.value)
              }
              className="
                flex
                w-full
                items-center
                gap-2
                rounded-md
                px-2
                py-2
                text-left
                text-sm
                text-slate-700
                transition-colors
                hover:bg-slate-100
              "
            >
              <span
                className="
                  flex
                  h-5
                  w-5
                  shrink-0
                  items-center
                  justify-center
                  rounded
                  bg-slate-100
              "
              >
                <Icon className="h-3.5 w-3.5 text-slate-600" />
              </span>

              <span>
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}