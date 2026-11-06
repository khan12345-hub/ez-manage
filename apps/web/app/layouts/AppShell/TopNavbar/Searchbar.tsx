"use client";

import { Search } from "lucide-react";

type SearchbarProps = {
  onOpen: () => void;
};

export function Searchbar({ onOpen }: SearchbarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      className="group relative flex h-10 w-full max-w-[520px] cursor-pointer items-center rounded-lg border border-border bg-background px-3.5 text-left transition-colors hover:border-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Search className="mr-3 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />

      <span className="flex-1 truncate text-sm text-muted-foreground">
        Jump to a board, workspace or action…
      </span>

      <kbd className="ml-3 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:flex">
        <span className="text-[13px] leading-none">⌘</span>
        <span>K</span>
      </kbd>
    </button>
  );
}
