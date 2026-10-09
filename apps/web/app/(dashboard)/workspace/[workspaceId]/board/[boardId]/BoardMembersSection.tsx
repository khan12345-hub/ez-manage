"use client";

import { useState } from "react";
import { ChevronDown, Crown, Settings2, UserMinus, Users } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ROLE_OPTIONS } from "@/components/InviteModal";
import { resolveUrl } from "@/lib/resolveUrl";

import type { BoardAccessMember } from "@/services/board-access-management.api";

interface BoardMembersSectionProps {
  members: BoardAccessMember[];
  groups?: { id: number; name: string; color?: string }[];
  columns?: { id: number; name: string; type: string }[];

  onRoleChange?: (memberId: number, role: "MEMBER" | "ADMIN" | "VIEWER") => void;
  onRemoveMember?: (memberId: number) => void;
  onGroupAccessChange?: (memberId: number, accessAllGroups: boolean, groupIds?: number[]) => void;

  isRoleUpdating?: boolean;
  isRemovingMember?: boolean;
  isGroupAccessUpdating?: boolean;
}

export function BoardMembersSection({
  members,
  groups = [],
  columns = [],
  onRoleChange,
  onRemoveMember,
  onGroupAccessChange,
  isRoleUpdating = false,
  isRemovingMember = false,
  isGroupAccessUpdating = false,
}: BoardMembersSectionProps) {
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Members</h3>
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
              `${member.user.firstName?.[0] ?? ""}${member.user.lastName?.[0] ?? ""}`.toUpperCase();
            const isOwner = member.role === "OWNER";
            const isExpanded = expandedMemberId === member.id;
            const avatarSrc = member.user.avatarUrl ?? member.user.avatar ?? undefined;

            return (
              <div key={member.id} className="rounded-lg border border-transparent hover:border-border/50">
                {/* Member row */}
                <div className="flex items-center gap-3 px-2 py-2.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage
                      src={avatarSrc ? resolveUrl(avatarSrc) : undefined}
                      alt={fullName}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
                      <Crown className="h-4 w-4 text-primary" />
                      <span>Owner</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      {/* Edit access toggle */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 text-muted-foreground",
                          isExpanded && "bg-accent text-foreground",
                        )}
                        title="Edit group access"
                        onClick={() =>
                          setExpandedMemberId(isExpanded ? null : member.id)
                        }
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>

                      {/* Role */}
                      <Select
                        value={member.role}
                        disabled={isRoleUpdating}
                        onValueChange={(value) => {
                          if (
                            value === "MEMBER" ||
                            value === "ADMIN" ||
                            value === "VIEWER"
                          ) {
                            onRoleChange?.(member.id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.filter((r) => r.value !== "OWNER").map(
                            (role) => (
                              <SelectItem key={role.id} value={role.value}>
                                {role.name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>

                      {/* Remove */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        disabled={isRemovingMember}
                        className="h-8 w-8"
                        onClick={() => onRemoveMember?.(member.id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded access panel — key forces remount when server data changes after save */}
                {isExpanded && !isOwner && (
                  <MemberAccessPanel
                    key={`${member.id}-${member.accessAllGroups}-${(member.groupAccess ?? []).map((g) => g.groupId).sort().join(",")}`}
                    member={member}
                    groups={groups}
                    columns={columns}
                    isUpdating={isGroupAccessUpdating}
                    onSave={(accessAllGroups, groupIds) =>
                      onGroupAccessChange?.(member.id, accessAllGroups, groupIds)
                    }
                  />
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

// ── Per-member access panel ───────────────────────────────────────────────────

interface MemberAccessPanelProps {
  member: BoardAccessMember;
  groups: { id: number; name: string; color?: string }[];
  columns: { id: number; name: string; type: string }[];
  isUpdating: boolean;
  onSave: (accessAllGroups: boolean, groupIds?: number[]) => void;
}

function MemberAccessPanel({
  member,
  groups,
  isUpdating,
  onSave,
}: MemberAccessPanelProps) {
  const initialAccessAllGroups = member.accessAllGroups ?? true;
  const initialGroupIds = (member.groupAccess ?? []).map((g) => g.groupId);

  const [accessAllGroups, setAccessAllGroups] = useState(initialAccessAllGroups);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(
    new Set(initialGroupIds),
  );

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSave = () => {
    onSave(accessAllGroups, accessAllGroups ? undefined : [...selectedGroupIds]);
  };

  const hasChanged =
    accessAllGroups !== initialAccessAllGroups ||
    (!accessAllGroups &&
      (selectedGroupIds.size !== initialGroupIds.length ||
        initialGroupIds.some((id) => !selectedGroupIds.has(id))));

  return (
    <div className="mx-2 mb-2 rounded-md border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Group Access
        </p>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* All groups toggle */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">All groups</p>
          <p className="text-xs text-muted-foreground">
            Member can see every group on this board
          </p>
        </div>
        <Switch
          checked={accessAllGroups}
          disabled={isUpdating}
          onCheckedChange={(checked) => {
            setAccessAllGroups(checked);
            if (checked) setSelectedGroupIds(new Set());
          }}
        />
      </div>

      {/* Specific group checkboxes (only when not all groups) */}
      {!accessAllGroups && groups.length > 0 && (
        <div className="space-y-1">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Select which groups this member can access:
          </p>
          {groups.map((group) => {
            const checked = selectedGroupIds.has(group.id);
            return (
              <button
                key={group.id}
                type="button"
                disabled={isUpdating}
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                  checked
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent bg-background hover:bg-accent/50",
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border-2"
                  style={{
                    backgroundColor: checked ? (group.color ?? "#6366f1") : "transparent",
                    borderColor: group.color ?? "#6366f1",
                  }}
                />
                <span className="flex-1 truncate text-sm">{group.name}</span>
                {checked && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    access
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!accessAllGroups && groups.length === 0 && (
        <p className="text-xs text-muted-foreground">No groups on this board yet.</p>
      )}

      {/* Zero-group warning */}
      {!accessAllGroups && selectedGroupIds.size === 0 && groups.length > 0 && (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          No groups selected — member will lose access to all groups on this board.
        </p>
      )}

      {/* Save button */}
      {hasChanged && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={isUpdating}
            onClick={handleSave}
            className="h-7 px-3 text-xs"
          >
            {isUpdating ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyMembers() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
      <Users className="mb-2 h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium">No members</p>
      <p className="text-xs text-muted-foreground">
        Invite people to collaborate on this board.
      </p>
    </div>
  );
}
