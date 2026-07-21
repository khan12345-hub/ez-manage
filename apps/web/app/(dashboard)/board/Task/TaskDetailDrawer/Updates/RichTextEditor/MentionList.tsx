"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { cn } from "@/lib/utils";

export interface MentionItem {
  id: number;
  label: string;
  email: string;
  avatar?: string | null;
}

export interface MentionListRef {
  onKeyDown: ({
    event,
  }: {
    event: KeyboardEvent;
  }) => boolean;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export const MentionList = forwardRef<
  MentionListRef,
  MentionListProps
>(function MentionList(
  {
    items,
    command,
  },
  ref,
) {
  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0);

  function selectItem(index: number) {
    const item = items[index];

    if (!item) {
      return;
    }

    command(item);
  }

  function upHandler() {
    if (items.length === 0) {
      return;
    }

    setSelectedIndex(
      (selectedIndex + items.length - 1) %
        items.length,
    );
  }

  function downHandler() {
    if (items.length === 0) {
      return;
    }

    setSelectedIndex(
      (selectedIndex + 1) %
        items.length,
    );
  }

  function enterHandler() {
    selectItem(selectedIndex);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
        No board members found
      </div>
    );
  }

  return (
    <div className="w-72 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
      {items.map((user, index) => (
        <button
          key={user.id}
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left",
            "hover:bg-accent",
            index === selectedIndex &&
              "bg-accent",
          )}
          onClick={() =>
            selectItem(index)
          }
        >
          <Avatar className="h-7 w-7">
            <AvatarImage
              src={
                user.avatar ??
                undefined
              }
            />

            <AvatarFallback className="text-xs">
              {getInitials(user.label)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {user.label}
            </div>

            <div className="truncate text-xs text-muted-foreground">
              {user.email}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

function getInitials(
  name: string,
) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}