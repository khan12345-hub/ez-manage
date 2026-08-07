"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, User2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Button } from "@/components/ui/button";

export interface PersonValue {
  users: BoardMember[];
}

interface Props {
  value?: PersonValue | null;
  onChange: (value: PersonValue | null) => void;
  placeholder?: string;
  className?: string;
  type?: "default" | "filter";
}

export default function PersonPicker({
  value,
  onChange,
  placeholder = "Search people...",
  className,
  type = "default",
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

  function getAvatarUrl(user: BoardMember) {
    if (!user.avatarUrl) return null;

    if (user.avatarUrl.startsWith("http")) {
      return user.avatarUrl;
    }

    return `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user.avatarUrl}`;
  }

  function AvatarContent({
    user,
    size = "h-8 w-8",
  }: {
    user: BoardMember;
    size?: string;
  }) {
    const avatarUrl = getAvatarUrl(user);

    return (
      <Avatar className={`${size} overflow-hidden`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${user.firstName} ${user.lastName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <AvatarFallback className="text-sm">
            {initials(user)}
          </AvatarFallback>
        )}
      </Avatar>
    );
  }

  function isSelected(user: BoardMember) {
    return selectedUsers.some((u) => u.id === user.id);
  }

  function handleSelect(user: BoardMember) {
    const exists = selectedUsers.some(
      (selectedUser) => selectedUser.id === user.id,
    );

    if (type === "filter") {
      if (exists) {
        onChange(null);
        return;
      }

      onChange({
        users: [user],
      });

      setOpen(false);
      return;
    }

    if (exists) {
      const newUsers = selectedUsers.filter(
        (selectedUser) => selectedUser.id !== user.id,
      );

      onChange(newUsers.length > 0 ? { users: newUsers } : null);
      return;
    }

    onChange({
      users: [...selectedUsers, user],
    });
  }

  function clearSelection() {
    onChange({ users: [] });
    setOpen(false);
  }

  function selectAll() {
    onChange({ users });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md bg-background transition-colors hover:bg-accent",
            className,
          )}
        >
          {selectedUsers.length === 0 ? (
            <>
              <User2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {type === "filter" ? "Select person" : "Assign person"}
              </span>
            </>
          ) : (
            <HoverCard openDelay={100}>
              <HoverCardTrigger asChild>
                <div className="inline-flex cursor-pointer -space-x-2">
                  {selectedUsers.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className="rounded-full border-2 border-background"
                    >
                      <AvatarContent user={user} size="h-10 w-10" />
                    </div>
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
                  {selectedUsers.length > 0 && selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-md p-2"
                    >
                      <AvatarContent user={user} />
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

        <div className="flex gap-2 px-4 py-2">
          {type === "default" && (
            <Button onClick={selectAll} variant="outline">
              Select All
            </Button>
          )}

          {selectedUsers.length > 0 && (
            <Button onClick={clearSelection} variant="destructive">
              {type === "filter" ? "Clear All" : "Unassign All"}
            </Button>
          )}
        </div>

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
                className="mb-2 flex w-full items-center gap-3 text-left transition-colors hover:bg-accent"
              >
                <AvatarContent user={user} />

                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </div>

                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </div>
                </div>

                {isSelected(user) && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}