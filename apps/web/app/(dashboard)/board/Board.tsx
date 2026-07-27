"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskRow } from "./group/tasks/TaskRow";
import { Plus } from "lucide-react";

import { BoardHeader } from "./BoardHeader/BoardHeader";
import { Group } from "./group/Group";
import { Button } from "@/components/ui/button";
import { HideColumnModal } from "./group/columns/HideColumnModal";
import { useGroupStore } from "@/store/create-group-store";
import { SortableGroup } from "./group/SortableGroup";
import { useInviteModalStore } from "@/store/invite-modal";
import { SortableGroupContainer } from "./group/SortableGroupContainer";
import { useBoardDnd } from "./hooks/useBoardDnd";

export function Board({ board }: any) {
  const groups = useGroupStore((s) => s.groups);
  const setGroups = useGroupStore((s) => s.setGroups);
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  const hasDraft = groups.some((g) => g.isNew);

  const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);
  const [hideColumnOpen, setHideColumnOpen] = useState(false);

  const [columns, setColumns] = useState(board.columns || []);
  const { boardId } = useInviteModalStore();

  useEffect(() => {
    if (board.columns) {
      setColumns(board.columns);
    }
  }, [board.columns]);

  const {
    dragGroups,
    dragColumns,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBoardDnd({
    groups,
    setGroups,
    columns,
    setColumns,
    boardId: board.id || boardId || 0,
  });

  function toggleColumn(id: number) {
    setHiddenColumns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllColumns(checked: boolean) {
    if (checked) {
      setHiddenColumns([]);
    } else {
      setHiddenColumns(board.columns.map((c: any) => c.id));
    }
  }

  const filteredColumns = dragColumns.filter(
    (column: any) => !hiddenColumns.includes(column.id),
  );

  return (
    <>
      <BoardHeader
        board={board}
        onHideColumns={() => setHideColumnOpen(true)}
      />

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <DragOverlay
          dropAnimation={{
            duration: 150,
            easing: "ease",
          }}
        >
          {activeItem?.type === "task" || activeItem?.type === "subtask" ? (
            <div className="opacity-90 shadow-2xl bg-background border rounded">
              <table>
                <tbody>
                  <TaskRow
                    task={activeItem.task}
                    color={activeItem.group.color || "#3B82F6"}
                    columns={filteredColumns}
                  />
                </tbody>
              </table>
            </div>
          ) : activeItem?.type === "group" ? (
            <div className="rotate-1 opacity-90 shadow-2xl bg-background border p-4 rounded min-w-[500px]">
              <span style={{ color: activeItem.group.color }} className="font-semibold text-lg">
                {activeItem.group.name}
              </span>
            </div>
          ) : activeItem?.type === "column" ? (
            <div className="rotate-1 opacity-90 shadow-2xl bg-background border px-6 py-3 font-semibold rounded min-w-[180px] text-center border-primary/50 text-primary">
              {activeItem.column.name}
            </div>
          ) : null}
        </DragOverlay>

        <SortableContext
          items={dragGroups.map((group: any) => `group-${group.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mb-4 space-y-6">
            {dragGroups.map((group: any) => (
              <SortableGroupContainer key={group.id} groupId={group.id as number}>
                {({ attributes, listeners }: any) => (
                  <SortableGroup key={group.id} id={group.id.toString()} groupId={group.id as number}>
                    <Group
                      group={group}
                      columns={filteredColumns}
                      dragHandleProps={{ ...attributes, ...listeners }}
                      isDraggingGroup={activeItem?.type === "group"}
                    />
                  </SortableGroup>
                )}
              </SortableGroupContainer>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        onClick={addNewGroup}
        disabled={hasDraft}
        className="h-12 cursor-pointer justify-center gap-2 border-dashed text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Add New Group
      </Button>

      <HideColumnModal
        open={hideColumnOpen}
        onOpenChange={setHideColumnOpen}
        columns={board.columns.filter(
          (column: any) => column.isPrimary === false,
        )}
        hiddenColumns={hiddenColumns}
        onToggle={toggleColumn}
        onToggleAll={toggleAllColumns}
      />
    </>
  );
}
