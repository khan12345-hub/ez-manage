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
      className="group relative flex h-10 w-full max-w-[520px] cursor-pointer items-center rounded-full border border-border bg-muted/50 px-4 text-left shadow-sm transition-all hover:bg-background hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <Search className="mr-3 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />

      <span className="flex-1 text-sm text-muted-foreground">
        Search for anything...
      </span>

      <kbd className="ml-3 hidden items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm sm:flex">
        <span className="text-[13px] leading-none">⌘</span>
        <span>K</span>
      </kbd>
    </button>
  );
}
