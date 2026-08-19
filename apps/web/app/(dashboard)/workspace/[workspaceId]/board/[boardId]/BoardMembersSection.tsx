"use client";

import {
  Crown,
  Trash2,
  Users,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ROLE_OPTIONS } from "@/components/InviteModal";

import type {
  BoardAccessMember,
} from "@/services/board-access-management.api";

interface BoardMembersSectionProps {
  members: BoardAccessMember[];

  onRoleChange?: (
    memberId: number,
    role: "MEMBER" | "ADMIN",
  ) => void;

  onRemoveMember?: (
    memberId: number,
  ) => void;

  isRoleUpdating?: boolean;
  isRemovingMember?: boolean;
}

export function BoardMembersSection({
  members,
  onRoleChange,
  onRemoveMember,
  isRoleUpdating = false,
  isRemovingMember = false,
}: BoardMembersSectionProps) {
  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            Members
          </h3>

          <p className="text-sm text-muted-foreground">
            Manage members and their permissions.
          </p>
        </div>

        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {members.length}
        </span>
      </div>

      {members.length > 0 ? (
        <div className="space-y-1">
          {members.map((member) => {
            const fullName =
              `${member.user.firstName} ${member.user.lastName}`.trim();

            const initials =
              `${member.user.firstName?.[0] ?? ""}${
                member.user.lastName?.[0] ?? ""
              }`.toUpperCase();

            const isOwner =
              member.role === "OWNER";

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
              >
                {/* Avatar */}
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={
                      member.user.avatar ??
                      undefined
                    }
                    alt={fullName}
                  />

                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* User info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fullName}
                  </p>

                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>

                {/* Owner */}
                {isOwner ? (
                  <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
                    <Crown className="h-4 w-4 text-primary" />

                    <span>Owner</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {/* Role */}
                    <Select
                      value={member.role}
                      disabled={
                        isRoleUpdating
                      }
                      onValueChange={(value) => {
                        if (
                          value === "MEMBER" ||
                          value === "ADMIN"
                        ) {
                          onRoleChange?.(
                            member.id,
                            value,
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {ROLE_OPTIONS.filter(
                          (role) =>
                            role.value !==
                            "OWNER",
                        ).map((role) => (
                          <SelectItem
                            key={role.id}
                            value={role.value}
                          >
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Remove */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={
                        isRemovingMember
                      }
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onRemoveMember?.(
                          member.id,
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyMembers />
      )}
    </div>
  );
}

function EmptyMembers() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
      <Users className="mb-2 h-5 w-5 text-muted-foreground" />

      <p className="text-sm font-medium">
        No members
      </p>

      <p className="text-xs text-muted-foreground">
        Invite people to collaborate on this board.
      </p>
    </div>
  );
}