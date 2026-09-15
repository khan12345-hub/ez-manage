"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getBoardMembers } from "@/services/boards.api";

interface Props {
  boardId: number;
  memberCount: number;
}

function avatarInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function BoardMembersPopover({ boardId, memberCount }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <Users className="h-3.5 w-3.5" />
          <span>{memberCount}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <MemberList boardId={boardId} />
      </PopoverContent>
    </Popover>
  );
}

function MemberList({ boardId }: { boardId: number }) {
  const { data: members, isLoading } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => getBoardMembers(boardId),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Loading members...
      </div>
    );
  }

  if (!members?.length) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">
        No members found.
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="border-b px-3 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Board Members ({members.length})
        </p>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50"
          >
            {m.avatarUrl ? (
              <img
                src={m.avatarUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {avatarInitials(m.firstName, m.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.firstName} {m.lastName}
              </p>
              {m.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {m.email}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
