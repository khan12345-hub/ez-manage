"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  boardId?: number;
  value: string;
  onChange: (value: string) => void;
}

export const SearchInput = forwardRef<
  HTMLInputElement,
  SearchInputProps
>(({ boardId, value, onChange }, forwardedRef) => {


  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search..."
        className="w-64 pl-9"
      />
    </div>
  );
});

SearchInput.displayName = "SearchInput";