"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, Loader2, MoveRight, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

import { StatusBulkAction } from "./StatusBulkEditor";
import {
  BulkActionColumn,
  BulkColumnSelector,
} from "./BulkActionsColumnSelector";
import { DateBulkEditor } from "./DateBulkEditor";
import { TimelineBulkAction } from "./TimelineBulkEditor";
import { CheckboxBulkAction } from "./CheckboxBulkEditor";
import { getBoards } from "@/services/boards.api";
import { getGroups } from "@/services/groups.api";

interface SimpleGroup {
  id: number;
  name: string;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  columns: BulkActionColumn[];
  groups: SimpleGroup[];
  workspaceId: number;
  currentBoardId: number;
  groupName?: string;

  onUpdate: (columnId: number, value: any) => void;
  onDelete: () => void;
  onMove: (targetGroupId: number) => void;
  onDuplicate: (withUpdates: boolean) => void;
  onClear: () => void;

  isUpdating?: boolean;
  isDeleting?: boolean;
  isMoving?: boolean;
  isDuplicating?: boolean;
}

type PendingAction =
  | { type: "update"; columnId: number; value: any }
  | { type: "delete" }
  | null;

function MoveToBoardDropdown({
  workspaceId,
  currentBoardId,
  onSelectGroup,
  disabled,
}: {
  workspaceId: number;
  currentBoardId: number;
  onSelectGroup: (groupId: number) => void;
  disabled: boolean;
}) {
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => getBoards(workspaceId),
    enabled: !!workspaceId,
  });

  const otherBoards = (boards as any[]).filter((b: any) => b.id !== currentBoardId);

  const { data: boardGroups = [] } = useQuery({
    queryKey: ["board-groups", selectedBoardId],
    queryFn: () => getGroups(selectedBoardId!),
    enabled: !!selectedBoardId,
  });

  if (selectedBoardId) {
    return (
      <>
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={(e) => { e.preventDefault(); setSelectedBoardId(null); }}
          >
            ← Back
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(boardGroups as any[]).length === 0 && (
          <DropdownMenuItem disabled>No groups found</DropdownMenuItem>
        )}
        {(boardGroups as any[]).map((g: any) => (
          <DropdownMenuItem
            key={g.id}
            onSelect={() => onSelectGroup(g.id)}
          >
            {g.name}
          </DropdownMenuItem>
        ))}
      </>
    );
  }

  return (
    <>
      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
        Select Board
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {otherBoards.length === 0 && (
        <DropdownMenuItem disabled>No other boards</DropdownMenuItem>
      )}
      {otherBoards.map((b: any) => (
        <DropdownMenuItem
          key={b.id}
          onSelect={(e) => { e.preventDefault(); setSelectedBoardId(b.id); }}
        >
          {b.name} <ChevronDown className="ml-auto h-3 w-3 -rotate-90" />
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function BulkActionToolbar({
  selectedCount,
  columns,
  groups,
  workspaceId,
  currentBoardId,
  groupName,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  onClear,
  isUpdating = false,
  isDeleting = false,
  isMoving = false,
  isDuplicating = false,
}: BulkActionToolbarProps) {
  const isBusy = isUpdating || isDeleting || isMoving || isDuplicating;

  const [selectedColumn, setSelectedColumn] = useState<BulkActionColumn | null>(null);
  const [pendingValue, setPendingValue] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [moveView, setMoveView] = useState<"root" | "board">("root");

  useEffect(() => {
    if (selectedCount === 0) {
      setSelectedColumn(null);
      setPendingValue(null);
      setPendingAction(null);
      setConfirmationOpen(false);
    }
  }, [selectedCount]);

  // Reset move view when menu closes
  useEffect(() => {
    if (!moveMenuOpen) setMoveView("root");
  }, [moveMenuOpen]);

  const handleColumnChange = (column: BulkActionColumn) => {
    setSelectedColumn(column);
    setPendingValue(null);
  };

  const handleApply = () => {
    if (!selectedColumn || pendingValue === null || isBusy) return;
    setPendingAction({ type: "update", columnId: selectedColumn.id, value: pendingValue });
    setConfirmationOpen(true);
  };

  const handleDelete = () => {
    if (isBusy) return;
    setPendingAction({ type: "delete" });
    setConfirmationOpen(true);
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    setConfirmationOpen(false);
    if (pendingAction.type === "delete") {
      onDelete();
    } else {
      onUpdate(pendingAction.columnId, pendingAction.value);
    }
    setPendingAction(null);
  };

  const handleConfirmationChange = (open: boolean) => {
    setConfirmationOpen(open);
    if (!open) setPendingAction(null);
  };

  const canApply = selectedColumn !== null && pendingValue !== null && !isBusy;

  const taskLabel = selectedCount === 1 ? "task" : "tasks";
  const groupText = groupName ? ` in "${groupName}"` : "";

  const updateDescription = selectedColumn ? (
    <>
      This will update the{" "}
      <span className="font-medium text-foreground">{selectedColumn.name}</span>{" "}
      field for{" "}
      <span className="font-medium text-foreground">
        {selectedCount} {taskLabel}
      </span>
      {groupName && (
        <>
          {" "}in{" "}
          <span className="font-medium text-foreground">"{groupName}"</span>
        </>
      )}.
    </>
  ) : "";

  const deleteDescription = (
    <>
      Are you sure you want to delete{" "}
      <span className="font-medium text-foreground">{selectedCount} {taskLabel}</span>
      {groupName && (
        <> from{" "}
          <span className="font-medium text-foreground">"{groupName}"</span>
        </>
      )}?<br /><br />
      This will permanently delete the selected {taskLabel}, including their{" "}
      <span className="font-medium text-foreground">files and comments</span>. This action cannot be undone.
    </>
  );

  const isDeleteConfirmation = pendingAction?.type === "delete";

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 px-6 py-4"
          >
            <div className="flex items-center gap-3 rounded-2xl border bg-background/95 px-5 py-3 shadow-2xl backdrop-blur-xl">
              {/* Count */}
              <div className="whitespace-nowrap text-sm font-medium">
                {selectedCount} {taskLabel} selected
                {groupName && (
                  <span className="ml-1 text-muted-foreground">in {groupName}</span>
                )}
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Move to */}
              <DropdownMenu open={moveMenuOpen} onOpenChange={setMoveMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {isMoving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MoveRight className="h-3.5 w-3.5" />
                    )}
                    {isMoving ? "Moving..." : "Move to"}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52" side="top">
                  {moveView === "root" ? (
                    <>
                      {/* Move to group in current board */}
                      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                        Move to Group
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {groups.length === 0 && (
                        <DropdownMenuItem disabled>No groups</DropdownMenuItem>
                      )}
                      {groups.map((g) => (
                        <DropdownMenuItem
                          key={g.id}
                          onSelect={() => {
                            onMove(g.id);
                            setMoveMenuOpen(false);
                          }}
                        >
                          <Check className="mr-2 h-3.5 w-3.5 opacity-0" />
                          {g.name}
                        </DropdownMenuItem>
                      ))}

                      <DropdownMenuSeparator />

                      {/* Move to another board */}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setMoveView("board");
                        }}
                        className="gap-2"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        Another board...
                        <ChevronDown className="ml-auto h-3 w-3 -rotate-90" />
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <MoveToBoardDropdown
                      workspaceId={workspaceId}
                      currentBoardId={currentBoardId}
                      disabled={isBusy}
                      onSelectGroup={(groupId) => {
                        onMove(groupId);
                        setMoveMenuOpen(false);
                      }}
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Duplicate */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {isDuplicating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {isDuplicating ? "Duplicating..." : "Duplicate"}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-52">
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Duplicate {taskLabel}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onDuplicate(false)}>
                    Without updates
                    <span className="ml-auto text-[10px] text-muted-foreground">name only</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onDuplicate(true)}>
                    With updates
                    <span className="ml-auto text-[10px] text-muted-foreground">all fields</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-6" />

              {/* Column selector + editor + Apply */}
              <BulkColumnSelector
                columns={columns}
                value={selectedColumn ? String(selectedColumn.id) : ""}
                disabled={isBusy}
                onChange={handleColumnChange}
              />

              {selectedColumn?.type === "STATUS" && (
                <StatusBulkAction
                  column={selectedColumn}
                  disabled={isBusy}
                  onChange={setPendingValue}
                />
              )}

              {selectedColumn?.type === "DATE" && (
                <DateBulkEditor
                  column={selectedColumn}
                  disabled={isBusy}
                  onChange={setPendingValue}
                />
              )}

              {selectedColumn?.type === "TIMELINE" && (
                <TimelineBulkAction
                  column={selectedColumn}
                  disabled={isBusy}
                  onChange={setPendingValue}
                />
              )}

              {selectedColumn?.type === "CHECKBOX" && (
                <CheckboxBulkAction
                  column={selectedColumn}
                  disabled={isBusy}
                  onChange={setPendingValue}
                />
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={!canApply}
                className="h-8"
              >
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {isUpdating ? "Applying..." : "Apply"}
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Delete */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isBusy}
                className="h-8"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Clear */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClear}
                disabled={isBusy}
                aria-label="Clear selection"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteConfirmationDialog
        open={confirmationOpen}
        onOpenChange={handleConfirmationChange}
        onConfirm={handleConfirmAction}
        isDeleting={isUpdating || isDeleting}
        title={
          isDeleteConfirmation
            ? `Delete ${selectedCount} ${taskLabel}${groupText}?`
            : `Update ${selectedCount} ${taskLabel}${groupText}?`
        }
        description={isDeleteConfirmation ? deleteDescription : updateDescription}
        confirmLabel={isDeleteConfirmation ? "Delete" : "Apply"}
        deletingLabel={isDeleteConfirmation ? "Deleting..." : "Applying..."}
      />
    </>
  );
}
