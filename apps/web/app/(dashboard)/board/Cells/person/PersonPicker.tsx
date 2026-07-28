"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, User2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getBoardMembers, BoardMember } from "@/services/boards.api";
import { useInviteModalStore } from "@/store/invite-modal";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export interface PersonValue {
  users: BoardMember[];
}

interface Props {

  value?: PersonValue | null;

  onChange: (value: PersonValue | null) => void;

  placeholder?: string;

  className?: string;
}

export default function PersonPicker({
  value,
  onChange,
  placeholder = "Search people...",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const { boardId } = useInviteModalStore();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId, debouncedSearch],
    queryFn: () => getBoardMembers(boardId, debouncedSearch),
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });


  const selectedUsers = value?.users ?? [];

  function initials(user: BoardMember | undefined) {
    return `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  }

  function isSelected(user: BoardMember) {
    return selectedUsers.some((u) => u.id === user.id);
  }

  function handleSelect(user: BoardMember) {
    const exists = selectedUsers.some((u) => u.id === user.id);

    if (exists) {
      onChange({
        users: selectedUsers.filter((u) => u.id !== user.id),
      });
    } else {
      onChange({
        users: [...selectedUsers, user],
      });
    }
  }

  function clearSelection() {
    onChange({ users: [] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex cursor-pointer w-full items-center gap-2 rounded-md bg-background hover:bg-accent transition-colors",
            className,
          )}
        >
          {selectedUsers.length === 0 ? (
            <>
              <User2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Assign person
              </span>
            </>
          )  : (
            <>
              <HoverCard openDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="inline-flex cursor-pointer -space-x-2">
                    {selectedUsers.slice(0, 3).map((user) => (
                      <Avatar
                        key={user.id}
                        className="h-10 w-10 border-2 border-background"
                      >
                        <AvatarImage src={user.avatar ?? undefined} />
                        <AvatarFallback>
                          {initials(user)}
                        </AvatarFallback>
                      </Avatar>
                    ))}

                    {selectedUsers.length > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                        +{selectedUsers.length - 3}
                      </div>
                    )}
                  </div>
                </HoverCardTrigger>

                <HoverCardContent side="top" align="start" className="w-72 p-2">
                  <div className="space-y-2">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 rounded-md p-2"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar ?? undefined} />
                          <AvatarFallback>{initials(user)}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {user.firstName} {user.lastName}
                          </div>

                          <div className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </HoverCardContent>
              </HoverCard>

              {/* <span className="text-sm">{selectedUsers.length} people 2</span> */}
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <>
            <button
              onClick={clearSelection}
              className="w-full border-b px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
            >
              Unassign
            </button>
          </>
        )}

        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Board Members
        </div>

        <ScrollArea className="h-72 px-4">
          {isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          )}

          {!isLoading && users.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No members found
            </div>
          )}

          {!isLoading &&
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className="flex w-full items-center gap-3  text-left transition-colors hover:bg-accent mb-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(user)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </div>

                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </div>
                </div>

                {isSelected(user) && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
