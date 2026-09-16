"use client";

import {
  useMemo,
  useState,
} from "react";

import { Plus, Search } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  AutomationActionType,
} from "./automation.actions";

import {
  AUTOMATION_ACTIONS,
} from "./automation.actions";

type AutomationActionPickerProps = {
  placeholder: string;

  disabled?: boolean;

  compact?: boolean;

  onSelect: (
    action: AutomationActionType,
  ) => void;
};

export default function AutomationActionPicker({
  placeholder,
  disabled = false,
  compact = false,
  onSelect,
}: AutomationActionPickerProps) {
  const [open, setOpen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const filteredActions =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return AUTOMATION_ACTIONS;
      }

      return AUTOMATION_ACTIONS.filter(
        (action) =>
          action.label
            .toLowerCase()
            .includes(query),
      );
    }, [search]);

  const mostUsed =
    filteredActions.filter(
      (action) =>
        action.category ===
        "Most used",
    );

  const featured =
    filteredActions.filter(
      (action) =>
        action.category ===
        "Featured",
    );

  const handleSelect = (
    action: AutomationActionType,
  ) => {
    onSelect(action);

    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (disabled) {
          return;
        }

        setOpen(value);

        if (!value) {
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            disabled={disabled}
            className="
              text-slate-500
              transition-colors
              hover:text-blue-600
              disabled:cursor-not-allowed
              disabled:text-slate-300
            "
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={`
              h-[38px]
              border-0
              border-b
              bg-transparent
              px-0
              text-lg sm:text-[25px]
              outline-none
              transition-colors

              ${
                disabled
                  ? `
                    cursor-not-allowed
                    border-slate-300
                    text-slate-300
                  `
                  : placeholder ===
                      "do this"
                    ? `
                      border-blue-500
                      text-blue-500
                      hover:text-blue-600
                    `
                    : `
                      border-slate-400
                      text-slate-400
                      hover:border-blue-500
                      hover:text-blue-500
                    `
              }
            `}
          >
            {placeholder}
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="
          w-[275px]
          rounded-lg
          border
          bg-white
          p-2
          shadow-xl
        "
      >
        <div
          className="
            mb-2
            flex
            h-9
            items-center
            rounded-md
            border
            border-blue-500
            px-2
          "
        >
          <Search
            className="
              mr-2
              h-4
              w-4
              text-slate-400
            "
          />

          <input
            autoFocus
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search"
            className="
              h-full
              w-full
              border-0
              bg-transparent
              text-sm
              outline-none
              placeholder:text-slate-400
            "
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto">
          {mostUsed.length > 0 && (
            <ActionSection
              title="Most used"
              actions={mostUsed}
              onSelect={handleSelect}
            />
          )}

          {featured.length > 0 && (
            <ActionSection
              title="Featured"
              actions={featured}
              onSelect={handleSelect}
            />
          )}

          {filteredActions.length ===
            0 && (
            <div
              className="
                px-2
                py-6
                text-center
                text-sm
                text-slate-400
              "
            >
              No actions found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActionSection({
  title,
  actions,
  onSelect,
}: {
  title: string;

  actions: readonly (typeof AUTOMATION_ACTIONS)[number][];

  onSelect: (
    action: AutomationActionType,
  ) => void;
}) {
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
                onSelect(
                  action.value,
                )
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
                hover:bg-slate-100
              "
            >
              <span
                className="
                  flex
                  h-5
                  w-5
                  items-center
                  justify-center
                  rounded
                  bg-slate-100
                "
              >
                <Icon className="h-3.5 w-3.5" />
              </span>

              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}