"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import {
  BoardMembersSection,
} from "./BoardMembersSection";

import {
  BoardVisibilitySection,
} from "./BoardVisibilitySection";

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

  onVisibilityChange?: (
    visibility: BoardVisibility,
  ) => void;

  onRoleChange?: (
    memberId: number,
    role: "MEMBER" | "ADMIN" | "VIEWER",
  ) => void;

  onRemoveMember?: (
    memberId: number,
  ) => void;

  isVisibilityUpdating?: boolean;
  isRoleUpdating?: boolean;
  isRemovingMember?: boolean;
}

export function ManageBoardAccessModal({
  open,
  onOpenChange,
  boardName,
  visibility,
  members,
  onVisibilityChange,
  onRoleChange,
  onRemoveMember,
  isVisibilityUpdating,
  isRoleUpdating,
  isRemovingMember,
}: ManageBoardAccessModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-140">
        {/* Header */}
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold">
            Manage access
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage who can access{" "}
            <strong>{boardName}</strong> and what
            they can do.
          </p>
        </div>

        <Separator />

        {/* Visibility */}
        <BoardVisibilitySection
          visibility={visibility}
          onChange={onVisibilityChange}
          disabled={isVisibilityUpdating}
        />

        <Separator />

        {/* Members */}
        <BoardMembersSection
          members={members}
          onRoleChange={onRoleChange}
          onRemoveMember={onRemoveMember}
          isRoleUpdating={isRoleUpdating}
          isRemovingMember={isRemovingMember}
        />
      </DialogContent>
    </Dialog>
  );
}