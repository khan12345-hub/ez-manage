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
      className="
        group
        relative
        flex
        h-10
        w-full
        max-w-[500px]
        items-center
        rounded-full
        border
        border-gray-200
        bg-gray-50/70
        px-4
        text-left
        shadow-sm
        transition-all
        hover:border-gray-300
        hover:bg-white
        hover:shadow-md
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
      "
    >
      <Search className="mr-3 h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600" />

      <span className="flex-1 text-sm text-gray-500">
        Search for anything...
      </span>

      <kbd className="hidden items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-500 shadow-sm sm:flex">
        <span>Ctrl</span>
        <span>K</span>
      </kbd>
    </button>
  );
}