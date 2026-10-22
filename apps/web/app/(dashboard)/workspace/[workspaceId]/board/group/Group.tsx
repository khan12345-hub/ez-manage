"use client";

import { useEffect, useMemo, useState } from "react";

import { useGroupStore } from "@/store/create-group-store";

import { GroupTable } from "./GroupTable";
import { GroupHeader } from "./GroupHeader";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { InfiniteData, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getBoardTasks, BoardTasksResponse } from "@/services/boards.api";

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
  search,
  personFilter,
  onTasksLoaded,
  ...props
}: any) {
  const boardId = group?.boardId;
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const queryClient = useQueryClient();

  const personFilterKey = personFilter?.users?.length
    ? personFilter.users.map((u: any) => u.id).join(",")
    : "";
  const searchTrimmed = (search ?? "").trim();

  /**
   * ---------------------------------------------------------
   * PER-GROUP INFINITE QUERY
   * ---------------------------------------------------------
   * Each group independently fetches its own tasks in parallel
   * with all other groups, using the groupId as a filter on the
   * shared board-tasks endpoint. This means "Not Approved" (133
   * tasks) loads immediately — it no longer waits for the 2626
   * tasks in "Reimbursement Paid" to finish paging through first.
   */
  const {
    data,
    isLoading: isGroupTasksLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError: isGroupTasksError,
  } = useInfiniteQuery<
    BoardTasksResponse,
    Error,
    InfiniteData<BoardTasksResponse>,
    any[],
    number | null
  >({
    queryKey: ["board-tasks", boardId, group.id, searchTrimmed, personFilterKey],

    queryFn: ({ pageParam }) =>
      getBoardTasks(boardId, {
        groupId: group.id,
        cursor: pageParam ?? undefined,
        limit: 500,
        search: searchTrimmed || undefined,
        person: personFilterKey || undefined,
      }),

    initialPageParam: null,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,

    staleTime: 30 * 60_000,
    gcTime: 120 * 60_000,
    refetchOnMount: false,

    enabled: !!boardId && !!group.id,
  });

  // Flatten all loaded pages, deduplicating by id
  const loadedTasks = useMemo(
    () =>
      Array.from(
        new Map(
          (data?.pages.flatMap((page: any) => page.tasks) ?? []).map(
            (task: any) => [task.id, task],
          ),
        ).values(),
      ),
    [data],
  );

  // Auto-fetch all pages — don't rely on scroll sentinel.
  // isGroupTasksError guard prevents an infinite retry loop: if a page fails
  // after React Query exhausts its retry budget, hasNextPage stays true but we
  // must stop firing fetchNextPage() or we hammer the API forever.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isGroupTasksError) return;
    const timer = setTimeout(() => fetchNextPage(), 200);
    return () => clearTimeout(timer);
  }, [hasNextPage, isFetchingNextPage, isGroupTasksError, fetchNextPage, loadedTasks.length]);

  // Report tasks up to Board so useBoardDnd can compute drag positions
  useEffect(() => {
    if (onTasksLoaded) {
      onTasksLoaded(group.id, loadedTasks);
    }
  }, [group.id, loadedTasks, onTasksLoaded]);

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

  const hydratedGroup = { ...group, tasks: loadedTasks };
  const rootTasks = loadedTasks.filter((t: any) => !t.parentId);
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

  // All tasks for this group are loaded when the query has settled with no further pages.
  // isGroupTasksLoading guards against the brief window at startup where hasNextPage
  // is still undefined, which would otherwise make this prematurely true.
  const allGroupTasksLoaded = !isGroupTasksLoading && !hasNextPage && !isFetchingNextPage;
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
          isGroupTasksLoading && rootTasks.length === 0
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
