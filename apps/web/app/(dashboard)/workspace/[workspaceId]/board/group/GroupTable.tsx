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
  setOpen
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
      <table className="min-w-[1200px] border-collapse">
        {showHeaders && (
          <thead>
            <tr className="border">
              <th
                className="sticky left-0 w-1.5"
                style={{
                  backgroundColor: group.color,
                }}
              />

              <th className="sticky left-2 bg-white">
                {!!selection && (
                  <Checkbox
                    checked={
                      groupSelection?.indeterminate
                        ? "indeterminate"
                        : groupSelection?.selected
                    }
                    onCheckedChange={() => selection.toggleGroup(group)}
                  />
                )}
              </th>

              <SortableContext
                items={columns.map((column: any) => `column-${column.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column: any) => (
                  <Headers key={column.id} column={column} />
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
              />
            )}
          </tbody>
        </SortableContext>
      </table>
    </div>
  );
}
