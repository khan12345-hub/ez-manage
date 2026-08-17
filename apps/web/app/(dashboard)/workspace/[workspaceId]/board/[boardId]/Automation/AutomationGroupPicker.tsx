"use client";

import {
  useMemo,
  useState,
} from "react";

import { Search } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type AutomationGroup = {
  id: string | number;

  name: string;
};

type AutomationGroupPickerProps = {
  groups: AutomationGroup[];

  value?: string;

  placeholder?: string;

  disabled?: boolean;

  onSelect: (
    groupId: string | number,
  ) => void;
};

export default function AutomationGroupPicker({
  groups,
  value,
  placeholder = "this group",
  disabled = false,
  onSelect,
}: AutomationGroupPickerProps) {
  const [open, setOpen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const selectedGroup =
    groups.find(
      (group) =>
        String(group.id) ===
        String(value),
    );

  const filteredGroups =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return groups;
      }

      return groups.filter(
        (group) =>
          group.name
            .toLowerCase()
            .includes(query),
      );
    }, [groups, search]);

  const handleSelect = (
    groupId: string | number,
  ) => {
    onSelect(groupId);

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
        <button
          type="button"
          disabled={disabled}
          className={`
            h-[38px]
            border-0
            border-b
            bg-transparent
            px-0
            text-[25px]
            outline-none
            transition-colors

            ${
              disabled
                ? `
                  cursor-not-allowed
                  border-slate-300
                  text-slate-300
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
          {selectedGroup
            ? `move item to ${selectedGroup.name}`
            : placeholder}
        </button>
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
            placeholder="Search groups"
            className="
              h-full
              w-full
              border-0
              bg-transparent
              text-sm
              outline-none
            "
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto">
          {filteredGroups.length ===
          0 ? (
            <div
              className="
                px-2
                py-6
                text-center
                text-sm
                text-slate-400
              "
            >
              No groups found
            </div>
          ) : (
            filteredGroups.map(
              (group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() =>
                    handleSelect(
                      group.id,
                    )
                  }
                  className="
                    flex
                    w-full
                    rounded-md
                    px-2
                    py-2
                    text-left
                    text-sm
                    text-slate-700
                    hover:bg-slate-100
                  "
                >
                  {group.name}
                </button>
              ),
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}