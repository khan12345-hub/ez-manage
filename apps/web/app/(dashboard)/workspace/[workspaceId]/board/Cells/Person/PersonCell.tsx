"use client";

import { User2 } from "lucide-react";
import { resolveUrl } from "@/lib/resolveUrl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface BoardMember {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string | null;
}

interface Props {
  cell?: { users?: BoardMember[] } | BoardMember | BoardMember[] | null | any;
}

/**
 * Normalise every stored shape into a flat list of users:
 *  - { users: [...] }        (current shape)
 *  - [ { users: [...] } ]    (wrapped)
 *  - [ user, user ]          (legacy array)
 *  - user                    (legacy single user)
 */
function toUserList(cell: Props["cell"]): BoardMember[] {
  if (!cell) return [];
  if (Array.isArray(cell)) {
    return cell.flatMap((c: any) =>
      Array.isArray(c?.users) ? c.users : c?.id != null ? [c] : [],
    );
  }
  if (Array.isArray(cell.users)) return cell.users;
  if (cell.id != null) return [cell];
  return [];
}

function initials(u: BoardMember) {
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function PersonCell({ cell }: Props) {
  const users = toUserList(cell);

  if (users.length === 0) {
    return (
      <Avatar className="h-7 w-7 border-2 border-background">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <User2 className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex cursor-pointer -space-x-2">
          {users.slice(0, 3).map((user) => {
            const avatarUrl = resolveUrl(user.avatarUrl) || undefined;
            return (
              <Avatar
                key={user.id}
                className="h-7 w-7 border-2 border-background overflow-hidden"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback>{initials(user)}</AvatarFallback>
                )}
              </Avatar>
            );
          })}

          {users.length > 3 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
              +{users.length - 3}
            </div>
          )}
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="start" className="w-64 p-2">
        <div className="space-y-2">
          {users.map((user) => {
            const avatarUrl = resolveUrl(user.avatarUrl) || undefined;
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
              >
                <Avatar className="h-8 w-8 overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <AvatarFallback>{initials(user)}</AvatarFallback>
                  )}
                </Avatar>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown user"}
                  </p>

                  {user.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
