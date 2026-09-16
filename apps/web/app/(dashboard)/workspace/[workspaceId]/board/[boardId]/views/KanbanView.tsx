"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getBoardTasks } from "@/services/boards.api";
import { useTaskDetailsStore } from "@/store/task-details-store";

interface KanbanViewProps {
  board: any;
}

function getStatusCell(task: any, columnId: number) {
  return task.cells?.find((c: any) => c.columnId === columnId);
}

function getPersonCell(task: any, columns: any[]) {
  const personCol = columns.find((c: any) => c.type === "PERSON");
  if (!personCol) return null;
  return task.cells?.find((c: any) => c.columnId === personCol.id);
}

function TaskCard({ task, columns, boardId, groupName, groupColor }: any) {
  const open = useTaskDetailsStore((s) => s.open);
  const personCell = getPersonCell(task, columns);
  const assignees: any[] = personCell?.value?.users ?? [];

  return (
    <div
      onClick={() => open({ taskId: task.id, boardId, groupId: task.groupId })}
      className="cursor-pointer rounded-lg border bg-background p-3 shadow-sm hover:shadow-md transition-shadow space-y-2"
    >
      <p className="text-xs font-medium leading-snug sm:text-sm">{task.name}</p>

      <div className="flex items-center justify-between">
        {/* Group pill */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: groupColor || "#6b7280" }}
        >
          {groupName}
        </span>

        {/* Assignee avatars */}
        {assignees.length > 0 && (
          <div className="flex -space-x-0.5 sm:-space-x-1">
            {assignees.slice(0, 3).map((u: any) => {
              const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
              const colors = ["bg-orange-500","bg-blue-500","bg-green-500","bg-purple-500","bg-rose-500"];
              const color = colors[(u.id ?? 0) % colors.length];
              return u.avatarUrl ? (
                <img key={u.id} src={u.avatarUrl} alt={initials}
                  className="h-4 w-4 rounded-full border border-background object-cover sm:h-5 sm:w-5" />
              ) : (
                <div key={u.id}
                  className={`flex h-4 w-4 items-center justify-center rounded-full border border-background text-[7px] font-bold text-white sm:h-5 sm:w-5 sm:text-[8px] ${color}`}>
                  {initials}
                </div>
              );
            })}
            {assignees.length > 3 && (
              <div className="flex h-4 w-4 items-center justify-center rounded-full border border-background bg-muted text-[7px] font-medium sm:h-5 sm:w-5 sm:text-[8px]">
                +{assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ board }: KanbanViewProps) {
  // Find first STATUS column
  const statusCol = board.columns?.find((c: any) => c.type === "STATUS");

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["board-tasks-kanban", board.id],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 500 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    enabled: !!board.id,
  });

  const allTasks: any[] = data?.pages.flatMap((p: any) => p.tasks) ?? [];

  // Build group lookup
  const groupMap = new Map<number, any>();
  (board.groups ?? []).forEach((g: any) => groupMap.set(g.id, g));

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="w-[calc(100vw-32px)] shrink-0 space-y-3 rounded-xl border bg-muted/30 p-3 sm:w-64">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            {[1,2].map(j => (
              <div key={j} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!statusCol) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No Status column found. Add a Status column to use Kanban view.
      </div>
    );
  }

  const statusOptions: any[] = statusCol.statusOptions ?? [];

  // Group tasks by status label
  const lanes: Record<string, any[]> = {};

  // Initialize lanes with empty arrays for each status option
  statusOptions.forEach((opt: any) => {
    lanes[opt.label] = [];
  });
  lanes["No Status"] = [];

  allTasks.forEach((task: any) => {
    const cell = getStatusCell(task, statusCol.id);
    const label = (cell?.value as any)?.label as string | undefined;
    const lane = label ? lanes[label] : undefined;
    if (lane) {
      lane.push(task);
    } else {
      lanes["No Status"]?.push(task);
    }
  });

  // Build display columns: status options + No Status (if any)
  const displayCols = [
    ...statusOptions.map((opt: any) => ({
      label: opt.label as string,
      color: opt.color as string,
      tasks: lanes[opt.label as string] ?? [],
    })),
    ...((lanes["No Status"]?.length ?? 0) > 0
      ? [{ label: "No Status", color: "#9ca3af", tasks: lanes["No Status"] ?? [] }]
      : []),
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1">
      {displayCols.map((col) => (
        <div key={col.label} className="flex w-[calc(100vw-32px)] shrink-0 flex-col rounded-xl border bg-muted/20 sm:w-64">
          {/* Column header */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: col.color }}
            />
            <span className="text-sm font-semibold flex-1 truncate">{col.label}</span>
            <span className="text-xs text-muted-foreground font-medium bg-muted rounded-full px-2 py-0.5">
              {col.tasks.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
            {col.tasks.length === 0 ? (
              <div className="flex h-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                No tasks
              </div>
            ) : (
              col.tasks.map((task: any) => {
                const group = groupMap.get(task.groupId);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    columns={board.columns}
                    boardId={board.id}
                    groupName={group?.name ?? ""}
                    groupColor={group?.color}
                  />
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
