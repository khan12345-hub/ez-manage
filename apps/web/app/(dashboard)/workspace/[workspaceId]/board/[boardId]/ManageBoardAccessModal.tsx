"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { BoardMembersSection } from "./BoardMembersSection";
import { BoardVisibilitySection } from "./BoardVisibilitySection";

import type {
  BoardAccessMember,
  BoardVisibility,
} from "@/services/board-access-management.api";

interface ManageBoardAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  boardName: string;
  visibility: BoardVisibility;
  members: BoardAccessMember[];
  groups?: { id: number; name: string; color?: string }[];
  columns?: { id: number; name: string; type: string }[];

  onVisibilityChange?: (visibility: BoardVisibility) => void;
  onRoleChange?: (memberId: number, role: "MEMBER" | "ADMIN" | "VIEWER") => void;
  onRemoveMember?: (memberId: number) => void;
  onGroupAccessChange?: (memberId: number, accessAllGroups: boolean, groupIds?: number[]) => void;

  isVisibilityUpdating?: boolean;
  isRoleUpdating?: boolean;
  isRemovingMember?: boolean;
  isGroupAccessUpdating?: boolean;
}

export function ManageBoardAccessModal({
  open,
  onOpenChange,
  boardName,
  visibility,
  members,
  groups = [],
  columns = [],
  onVisibilityChange,
  onRoleChange,
  onRemoveMember,
  onGroupAccessChange,
  isVisibilityUpdating,
  isRoleUpdating,
  isRemovingMember,
  isGroupAccessUpdating,
}: ManageBoardAccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-140">
        {/* Header */}
        <div className="shrink-0 px-6 py-5">
          <h2 className="text-lg font-semibold">Manage access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage who can access <strong>{boardName}</strong> and what they can do.
          </p>
        </div>

        <Separator className="shrink-0" />

        {/* Visibility */}
        <div className="shrink-0">
          <BoardVisibilitySection
            visibility={visibility}
            onChange={onVisibilityChange}
            disabled={isVisibilityUpdating}
          />
        </div>

        <Separator className="shrink-0" />

        {/* Members — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BoardMembersSection
            members={members}
            groups={groups}
            columns={columns}
            onRoleChange={onRoleChange}
            onRemoveMember={onRemoveMember}
            onGroupAccessChange={onGroupAccessChange}
            isRoleUpdating={isRoleUpdating}
            isRemovingMember={isRemovingMember}
            isGroupAccessUpdating={isGroupAccessUpdating}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
