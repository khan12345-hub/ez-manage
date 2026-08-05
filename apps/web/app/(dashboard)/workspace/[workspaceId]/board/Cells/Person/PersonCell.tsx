"use client";

import { User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface BoardMember {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  avatar?: string | null;
}

interface Props {
  cell?: BoardMember | BoardMember[] | null | any;
}

export function PersonCell({ cell }: Props) {
  const users = cell ? (Array.isArray(cell) ? cell : [cell]) : [];
  console.log({users})
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
            const avatarUrl = user.avatarUrl
              ? `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user.avatarUrl}`
              : undefined;
            console.log({avatarUrl})
            return (
              <Avatar
                key={user.id}
                className="h-7 w-7 border-2 border-background overflow-hidden"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback>
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </AvatarFallback>
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
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {/* {user.firstName?.[0]} */}
                  {user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.firstName} {user.lastName}
                </p>

                {user.email && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
