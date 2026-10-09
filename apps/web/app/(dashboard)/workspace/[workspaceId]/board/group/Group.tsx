"use client";

import { useState } from "react";

import { useGroupStore } from "@/store/create-group-store";

import { GroupTable } from "./GroupTable";
import { GroupHeader } from "./GroupHeader";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const NAME_WIDTHS = ["w-48", "w-36", "w-56", "w-28", "w-44", "w-40", "w-32", "w-52"];
const CELL_WIDTHS = ["w-16", "w-20", "w-12", "w-24", "w-14", "w-18"];

function GroupTasksSkeleton({
  columns = [],
  count = 8,
  color,
}: {
  columns?: any[];
  count?: number;
  color?: string;
}) {
  return (
    <div className="w-full overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
      <table className="w-full min-w-[1200px] border-collapse">
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <tr key={i} className="border-b border-border/40">
              {/* Group color bar */}
              <td className="w-1.5 border-0 p-0" style={{ backgroundColor: color ?? "transparent" }} />
              {/* Task name cell */}
              <td className="sticky left-1.5 z-20 w-[200px] bg-background px-3 py-2.5 sm:w-[450px]">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded bg-muted/40" />
                  <div className="h-4 w-4 shrink-0 rounded bg-muted/40" />
                  <Skeleton className={`h-3.5 ${NAME_WIDTHS[i % NAME_WIDTHS.length]}`} />
                </div>
              </td>
              {/* One skeleton cell per column */}
              {columns.map((col: any, ci: number) => (
                <td key={col.id} className="border-l px-3 py-2.5" style={{ minWidth: 120 }}>
                  <Skeleton className={`h-3.5 ${CELL_WIDTHS[(i + ci) % CELL_WIDTHS.length]}`} />
                </td>
              ))}
              {/* Spacer for "Add Column" */}
              <td className="w-44" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Group({
  group,
  columns,
  selection,
  newTaskFocusToken = 0,
  members,
  isTasksLoading = false,
  isFetchingNextPage = false,
  allTasksLoaded = false,
  ...props
}: any) {
  const boardId = group?.boardId;
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const queryClient = useQueryClient();

  const createColumnMutation = useMutation({
    mutationFn: (type: BoardColumnType) => createColumn(boardId || 0, type),

    onSuccess: () => {
      toast.success("Column created");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      setOpen(false);
    },

    onError: () => {
      toast.error("Failed to create column");
    },
  });

  const hydratedGroup = group;
  const rootTasks = (group.tasks ?? []).filter((t: any) => !t.parentId);
  // Use the server-side total from _count so the header shows the real count
  // even when only a subset of tasks has been loaded via infinite scroll.
  const rootTaskCount = group._count?.tasks ?? rootTasks.length;

  // Find a STATUS or CHECKBOX column to measure completion
  const colList: any[] = Array.isArray(columns) ? columns : [];
  const checkboxCol = colList.find((c: any) => c.type === "CHECKBOX");
  const statusCol = colList.find((c: any) => c.type === "STATUS");

  const completedTaskCount = rootTasks.filter((task: any) => {
    if (checkboxCol) {
      const cell = task.cells?.find((c: any) => c.columnId === checkboxCol.id);
      const val = cell?.value;
      if (val === true) return true;
      if (val && typeof val === "object") {
        if (val.checked === true) return true;
        if (val.checked?.checked === true) return true;
      }
    }
    if (statusCol) {
      const cell = task.cells?.find((c: any) => c.columnId === statusCol.id);
      const label: string = cell?.value?.label ?? "";
      if (/done|complet|finish/i.test(label)) return true;
    }
    return false;
  }).length;

  // Only show the progress bar when all tasks for this group are loaded —
  // otherwise completedTaskCount would be based on a partial set.
  const allGroupTasksLoaded = rootTasks.length >= rootTaskCount;
  const showProgress = allGroupTasksLoaded && (checkboxCol || statusCol) && rootTaskCount > 0;

  return (
    <>
      <div>
        <GroupHeader
          group={group}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((v) => !v)}
          onAddGroup={addNewGroup}
          taskCount={rootTaskCount}
          completedTaskCount={showProgress ? completedTaskCount : undefined}
          tasks={rootTasks}
          columns={colList}
        />

        {!isCollapsed && (
          isTasksLoading && rootTasks.length === 0
            ? <GroupTasksSkeleton columns={columns} color={group.color} />
            : <GroupTable
                group={hydratedGroup}
                columns={columns}
                selection={selection}
                showSelection={false}
                showNewTaskRow
                showAddColumn={false}
                setOpen={setOpen}
                newTaskFocusToken={newTaskFocusToken}
                members={members}
                isFetchingNextPage={isFetchingNextPage}
                allTasksLoaded={allGroupTasksLoaded}
                totalTaskCount={rootTaskCount}
              />
        )}
      </div>

      <ColumnTypeModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(type) => {
          createColumnMutation.mutate(type);
        }}
      />
    </>
  );
}
