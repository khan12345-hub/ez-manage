"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";

import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  MoreHorizontal,
  MoveUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  updateGroup,
  deleteGroup,
  duplicateGroup,
  archiveGroup,
  exportGroupExcel,
  reorderGroup,
} from "@/services/groups.api";

import { useGroupStore } from "@/store/create-group-store";
import { useShallow } from "zustand/react/shallow";
import { useInviteModalStore } from "@/store/invite-modal";
import { STATUS_COLORS } from "@/constants/colors";
import { getErrorMessage } from "@/lib/error-message";

interface Props {
  group: any;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAddGroup: () => void;
}

export function GroupActions({
  group,
  isCollapsed,
  onToggleCollapse,
  onAddGroup,
}: Props) {
  const queryClient = useQueryClient();

  const updateLocal = useGroupStore((s) => s.updateGroup);
  const removeLocal = useGroupStore((s) => s.removeGroup);
  const allGroups = useGroupStore(useShallow((s) => s.groups.filter((g) => !g.isNew)));

  const { boardId } = useInviteModalStore();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  /* ── Update (rename / color) ── */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateGroup(boardId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: ({ id, boardId }: { id: number; boardId: number }) =>
      deleteGroup(id, boardId),
    onSuccess: (_, vars) => {
      removeLocal(vars.id);
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to delete group")),
  });

  /* ── Duplicate ── */
  const duplicateMutation = useMutation({
    mutationFn: (withUpdates: boolean) =>
      duplicateGroup(boardId!, group.id, withUpdates),
    onSuccess: () => {
      toast.success("Group duplicated");
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to duplicate group")),
  });

  /* ── Archive ── */
  const archiveMutation = useMutation({
    mutationFn: () => archiveGroup(boardId!, group.id),
    onSuccess: () => {
      removeLocal(group.id);
      toast.success("Group archived");
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to archive group")),
  });

  /* ── Reorder (move to top / bottom) ── */
  const reorderMutation = useMutation({
    mutationFn: (dto: {
      groupId: number;
      previousGroupId?: number | null;
      nextGroupId?: number | null;
    }) => reorderGroup(boardId!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to move group")),
  });

  /* ── Handlers ── */
  const handleRename = () => updateLocal(group.id, { isEditing: true });

  const handleColorChange = (color: string) => {
    updateLocal(group.id, { color });
    if (!group.isNew && boardId) {
      updateMutation.mutate({ id: group.id, data: { boardId, color } });
    }
  };

  const handleMoveToTop = () => {
    const others = allGroups.filter((g) => g.id !== group.id);
    if (others.length === 0) return;
    reorderMutation.mutate({
      groupId: group.id,
      previousGroupId: null,
      nextGroupId: Number(others[0]!.id),
    });
  };

  const handleMoveToBottom = () => {
    const others = allGroups.filter((g) => g.id !== group.id);
    if (others.length === 0) return;
    reorderMutation.mutate({
      groupId: group.id,
      previousGroupId: Number(others[others.length - 1]!.id),
      nextGroupId: null,
    });
  };

  const handleExportExcel = () => {
    if (!boardId) return;
    exportGroupExcel(boardId, group.id, group.name).catch((err) =>
      toast.error(getErrorMessage(err, "Export failed")),
    );
  };

  const handleDeleteConfirm = () => {
    if (!boardId) return;
    if (group.isNew) { removeLocal(group.id); return; }
    deleteMutation.mutate({ id: group.id, boardId });
  };

  /* ── Position helpers ── */
  const groupIndex = allGroups.findIndex((g) => g.id === group.id);
  const isFirst = groupIndex === 0;
  const isLast = groupIndex === allGroups.length - 1;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* ── Collapse / Expand ── */}
          <DropdownMenuItem onClick={onToggleCollapse}>
            {isCollapsed ? (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Expand group
              </>
            ) : (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Minimize group
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* ── Rename ── */}
          <DropdownMenuItem onClick={handleRename}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename group
          </DropdownMenuItem>

          {/* ── Color picker ── */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-sm">Change color</span>
            <ColorPicker
              value={group.color}
              colors={STATUS_COLORS}
              onChange={handleColorChange}
            >
              <button
                type="button"
                className="h-6 w-6 rounded-md border transition hover:scale-110"
                style={{ backgroundColor: group.color }}
                aria-label="Change group color"
              />
            </ColorPicker>
          </div>

          <DropdownMenuSeparator />

          {/* ── Add group ── */}
          <DropdownMenuItem onClick={onAddGroup}>
            <Plus className="mr-2 h-4 w-4" />
            Add group
          </DropdownMenuItem>

          {/* ── Duplicate ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate group
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => duplicateMutation.mutate(false)}
                disabled={duplicateMutation.isPending}
              >
                {duplicateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Duplicate items
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => duplicateMutation.mutate(true)}
                disabled={duplicateMutation.isPending}
              >
                {duplicateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Duplicate items &amp; updates
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* ── Move group ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MoveUp className="mr-2 h-4 w-4" />
              Move group
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={handleMoveToTop}
                disabled={isFirst || reorderMutation.isPending}
              >
                <ChevronUp className="mr-2 h-4 w-4" />
                Move to top
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleMoveToBottom}
                disabled={isLast || reorderMutation.isPending}
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                Move to bottom
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* ── Export ── */}
          <DropdownMenuItem onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* ── Archive ── */}
          <DropdownMenuItem
            onClick={() => setArchiveOpen(true)}
            className="text-amber-600 focus:text-amber-600"
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive group
          </DropdownMenuItem>

          {/* ── Delete ── */}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (group.isNew) { removeLocal(group.id); return; }
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="size-5 text-destructive" />
            </AlertDialogMedia>
            <div>
              <AlertDialogTitle className="text-base">Delete group?</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                <span className="mb-2 flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: group.color ?? "#ccc" }}
                  />
                  <span className="font-medium text-foreground text-sm">{group.name}</span>
                </span>
                All tasks inside this group will be permanently deleted. This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 className="size-4" /> Delete group</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Archive confirmation ── */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100">
              <Archive className="size-5 text-amber-600" />
            </AlertDialogMedia>
            <div>
              <AlertDialogTitle className="text-base">Archive group?</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                <span className="mb-2 flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: group.color ?? "#ccc" }}
                  />
                  <span className="font-medium text-foreground text-sm">{group.name}</span>
                </span>
                This group will be hidden from the board. You can restore it later.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={archiveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Archiving…</>
              ) : (
                <><Archive className="size-4" /> Archive group</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
