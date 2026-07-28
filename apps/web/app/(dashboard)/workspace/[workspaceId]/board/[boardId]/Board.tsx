"use client";

import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Plus } from "lucide-react";

import { TaskRow } from "../group/tasks/TaskRow";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { Group } from "../group/Group";

import { Button } from "@/components/ui/button";

import { HideColumnModal } from "../group/columns/HideColumnModal";

import { useGroupStore } from "@/store/create-group-store";

import { SortableGroup } from "../group/SortableGroup";
import { SortableGroupContainer } from "../group/SortableGroupContainer";
import { useBoard } from "./hooks/useBoard.hooks";

export function Board({ board }: any) {
  const addNewGroup = useGroupStore((state) => state.addNewGroup);

  const hasDraft = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );

  const {
    dragGroups,
    filteredColumns,
    activeItem,
    filters,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBoard({
    board,
  });

  return (
    <>
      <BoardHeader
        board={board}
        onHideColumns={filters.openHideColumnModal}
        personFilter={filters.personFilter}
        onPersonFilterChange={filters.setPersonFilter}
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
            <div className="rotate-1 rounded border bg-background opacity-90 shadow-2xl">
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
          items={dragGroups.map((group: any) => `group-${group.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mb-4 space-y-6">
            {dragGroups.map((group: any) => (
              <SortableGroupContainer
                key={group.id}
                groupId={group.id as number}
              >
                {({ attributes, listeners }: any) => (
                  <SortableGroup
                    id={group.id.toString()}
                    groupId={group.id as number}
                  >
                    <Group
                      group={group}
                      columns={filteredColumns}
                      dragHandleProps={{
                        ...attributes,
                        ...listeners,
                      }}
                      isDraggingGroup={activeItem?.type === "group"}
                      isDraggingTask={activeItem?.type === "task"}
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
