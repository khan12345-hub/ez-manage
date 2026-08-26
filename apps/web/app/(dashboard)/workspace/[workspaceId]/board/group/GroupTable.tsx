"use client";

import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { Checkbox } from "@/components/ui/checkbox";

import { Headers } from "./columns/Headers";
import { TaskHierarchyRow } from "./tasks/TaskRowHierarchy";
import { NewTaskRow } from "./tasks/AddNewTaskRow";
import { Plus } from "lucide-react";

interface Props {
  group: any;
  columns: any[];

  color?: string;

  selection?: any;

  isDraggingGroup?: boolean;
  isDraggingTask?: boolean;

  showSelection?: boolean;
  showHeaders?: boolean;
  showNewTaskRow?: boolean;
  showAddColumn?: boolean;
  setOpen: (open: boolean) => void;
  newTaskFocusToken?: number;
  members?: Array<{
    id: number;
    role: string;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    userId: number;
  }>;
}

export function GroupTable({
  group,
  columns,
  selection,
  isDraggingGroup,
  isDraggingTask,
  showSelection = true,
  showHeaders = true,
  showNewTaskRow = true,
  setOpen,
  newTaskFocusToken = 0,
  members,
}: Props) {
  const { setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,
    data: {
      type: "group-drop",
      groupId: group.id,
    },
  });

  const rootTasks = (group.tasks ?? []).filter((task: any) => !task.parentId);

  const groupSelection = selection?.getGroupSelectionState(group);

  return (
    <div className="overflow-x-auto scrollbar-none">
      <table className="min-w-300 border-collapse">
        {showHeaders && (
          <thead>
            <tr className="border">
              <th
                className="sticky left-0 w-1.5 z-10"
                style={{
                  backgroundColor: group.color,
                }}
              />
              <th className="bg-white w-[450px] sticky left-1.5 z-10">
                <div className="flex justify-end">
                  {!!selection && (
                    <Checkbox
                      className="mr-5"
                      checked={
                        groupSelection?.indeterminate
                          ? "indeterminate"
                          : groupSelection?.selected
                      }
                      onCheckedChange={() => selection.toggleGroup(group)}
                    />
                  )}
                </div>
              </th>

              <SortableContext
                items={columns.map((column: any) => `column-${column.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column: any) => (
                  <Headers key={column.id} column={column} members={members} />
                ))}
              </SortableContext>

              <th
                onClick={() => setOpen(true)}
                className="flex w-44 cursor-pointer items-center gap-2 px-4 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </th>
            </tr>
          </thead>
        )}

        <SortableContext
          items={rootTasks.map((task: any) => `task-${task.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <tbody ref={setNodeRef}>
            {rootTasks.map((task: any) => (
              <TaskHierarchyRow
                key={task.id}
                task={task}
                columns={columns}
                color={group.color}
                isDraggingTask={isDraggingTask}
                selection={selection}
                showSelection={showSelection}
              />
            ))}

            {showNewTaskRow && (
              <NewTaskRow
                columns={columns}
                color={group.color}
                groupId={group.id}
                focusToken={newTaskFocusToken}
              />
            )}
          </tbody>
        </SortableContext>
      </table>
    </div>
  );
}
