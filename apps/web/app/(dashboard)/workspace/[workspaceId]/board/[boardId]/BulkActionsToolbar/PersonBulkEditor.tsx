"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getBoardMembers, BoardMember } from "@/services/boards.api";
import { cn } from "@/lib/utils";

interface PersonBulkEditorProps {
  boardId: number;
  disabled?: boolean;
  onChange?: (value: { userId: number; firstName: string; lastName: string; avatarUrl: string | null } | null) => void;
}

function memberInitials(m: BoardMember) {
  return `${m.firstName[0] ?? ""}${m.lastName[0] ?? ""}`.toUpperCase();
}

export function PersonBulkEditor({ boardId, disabled = false, onChange }: PersonBulkEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BoardMember | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId, search],
    queryFn: () => getBoardMembers(boardId, search),
    enabled: open && !!boardId,
    staleTime: 1000 * 60 * 5,
  });

  const handleSelect = (member: BoardMember) => {
    const isSame = selected?.id === member.id;
    const next = isSame ? null : member;
    setSelected(next);
    onChange?.(
      next
        ? { userId: next.id, firstName: next.firstName, lastName: next.lastName, avatarUrl: next.avatarUrl ?? null }
        : null
    );
    if (!isSame) setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    onChange?.(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 w-[180px] justify-start gap-2 px-2.5"
        >
          {selected ? (
            <>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {memberInitials(selected)}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-sm">
                {selected.firstName} {selected.lastName}
              </span>
              <X className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" onClick={handleClear} />
            </>
          ) : (
            <>
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 text-left text-sm text-muted-foreground">Pick a person…</span>
              <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-60 p-0" align="start" side="top">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-52 overflow-y-auto p-1">
          {isLoading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          )}
          {!isLoading && members.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No members found.</p>
          )}
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                selected?.id === m.id && "bg-accent",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {memberInitials(m)}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">
                {m.firstName} {m.lastName}
              </span>
              {selected?.id === m.id && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
