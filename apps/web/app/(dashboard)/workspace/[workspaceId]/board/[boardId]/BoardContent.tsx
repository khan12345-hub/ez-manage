"use client";

import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { TaskRow } from "../group/tasks/TaskRow";
import { Group } from "../group/Group";
import { Button } from "@/components/ui/button";
import { HideColumnModal } from "../group/columns/HideColumnModal";
import { useGroupStore } from "@/store/create-group-store";
import { SortableGroup } from "../group/SortableGroup";
import { SortableGroupContainer } from "../group/SortableGroupContainer";
import { BoardSkeleton } from "./BoardSkeleton";
import { BulkActionToolbar } from "./BulkActionsToolbar";

interface BoardContentProps {
  board: any;
  search: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  dragGroups: any[];
  filteredColumns: any[];
  activeItem: any;
  filters: any;
  handleDragStart: (event: any) => void;
  handleDragOver: (event: any) => void;
  handleDragEnd: (event: any) => void;
  handleDragCancel: () => void;
  selection: any;
}

export function BoardContent({
  board,
  search,
  isLoading,
  isFetching,
  isError,
  dragGroups,
  filteredColumns,
  activeItem,
  filters,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleDragCancel,
  selection,
}: BoardContentProps) {
  const addNewGroup = useGroupStore((state) => state.addNewGroup);

  const hasDraft = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );

  const statusColumns = (board.columns ?? [])
    .filter((column: any) => column.type === "STATUS")
    .map((column: any) => ({
      id: column.id,
      name: column.name,
      options: column.statusOptions ?? [],

    }));

  console.log("STATUS COLUMNS:", statusColumns);
  

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (isError || !board) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground ">
        Board not found.
      </div>
    );
  }

  const groupsToRender = dragGroups;

  return (
    <>
      <BulkActionToolbar
        selectedCount={selection.selectedCount}
        statusColumns={statusColumns}
        onStatusChange={(columnId, statusId) => {
          console.log({
            taskIds: Array.from(selection.selectedTaskIds),
            columnId,
            statusId,
          });
        }}
        onDelete={() => {
          console.log(Array.from(selection.selectedTaskIds));
        }}
        onClear={selection.clearSelection}
      />
      <div
        className={
          isFetching ? "opacity-60 transition-opacity" : "transition-opacity"
        }
      >
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
              <div className="rotate-1 rounded border bg-background opacity-90 shadow-2xl ">
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
              <div className="min-w-[500px] rotate-1 rounded border bg-background p-4 opacity-90 shadow-2xl">
                <span
                  style={{
                    color: activeItem.group.color,
                  }}
                  className="text-lg font-semibold"
                >
                  {activeItem.group.name}
                </span>
              </div>
            ) : activeItem?.type === "column" ? (
              <div className="min-w-[180px] rotate-1 rounded border border-primary/50 bg-background px-6 py-3 text-center font-semibold text-primary opacity-90 shadow-2xl">
                {activeItem.column.name}
              </div>
            ) : null}
          </DragOverlay>

          <SortableContext
            items={groupsToRender.map((group: any) => `group-${group.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mb-4 space-y-6 mt-20">
              {groupsToRender.map((group: any) => (
                <SortableGroupContainer key={group.id} groupId={group.id}>
                  {({ attributes, listeners }: any) => (
                    <SortableGroup id={group.id.toString()} groupId={group.id}>
                      <Group
                        group={group}
                        columns={filteredColumns}
                        dragHandleProps={{
                          ...attributes,
                          ...listeners,
                        }}
                        isDraggingGroup={activeItem?.type === "group"}
                        isDraggingTask={activeItem?.type === "task"}
                        selection={selection}
                      />
                    </SortableGroup>
                  )}
                </SortableGroupContainer>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {search.trim() && !isFetching && groupsToRender.length === 0 && (
        <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No matching groups, tasks, file, date, timeline or person found.
        </div>
      )}

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
        open={filters.hideColumnOpen}
        onOpenChange={filters.setHideColumnOpen}
        columns={filters.hideableColumns}
        hiddenColumnIds={filters.hiddenColumnIds}
        allColumnsVisible={filters.allColumnsVisible}
        onToggleColumn={filters.toggleColumn}
        onToggleAllColumns={filters.toggleAllColumns}
      />
    </>
  );
}
