"use client";

import { useRef } from "react";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import { Headers } from "./columns/Headers";
import { TaskHierarchyRow } from "./tasks/TaskRowHierarchy";
import { NewTaskRow } from "./tasks/AddNewTaskRow";
import { GroupFooterRow } from "./GroupFooterRow";

import { Plus } from "lucide-react";

const VIRTUALIZE_THRESHOLD = 50;

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
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  allTasksLoaded?: boolean;
  totalTaskCount?: number;
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
  isDraggingTask,
  showSelection = true,
  showHeaders = true,
  showNewTaskRow = true,
  setOpen,
  newTaskFocusToken = 0,
  members,
  isFetching,
  isFetchingNextPage,
  allTasksLoaded = false,
  totalTaskCount,
}: Props) {
  const { setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,
    data: {
      type: "group-drop",
      groupId: group.id,
    },
  });

  const rootTasks = (group.tasks ?? []).filter(
    (task: any) => !task.parentId,
  );

  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  const shouldVirtualize = rootTasks.length > VIRTUALIZE_THRESHOLD;

  // The app's scroll container is <main> (overflow-auto in AppShell), not the window.
  // useWindowVirtualizer uses window.scrollY which is always 0 here, so only the
  // first ~14 rows ever render. useVirtualizer with the correct scroll element fixes this.
  const rowVirtualizer = useVirtualizer({
    count: rootTasks.length,
    estimateSize: () => 41,
    overscan: 10,
    getScrollElement: () => {
      if (typeof document === "undefined") return null;
      return document.querySelector("main");
    },
    // Distance from main's content top to tbody's position in that content.
    // This stays constant as the user scrolls because scrollTop compensates for
    // the changing getBoundingClientRect values.
    scrollMargin: (() => {
      const tbody = tbodyRef.current;
      const main =
        typeof document !== "undefined"
          ? document.querySelector("main")
          : null;
      if (!tbody || !main) return 0;
      return (
        tbody.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop
      );
    })(),
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const paddingTop =
    shouldVirtualize && virtualItems.length > 0
      ? Math.max(0, virtualItems[0].start - rowVirtualizer.options.scrollMargin)
      : 0;

  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? Math.max(
          0,
          rowVirtualizer.getTotalSize() -
            virtualItems[virtualItems.length - 1].end,
        )
      : 0;

  const setCombinedRef = (el: HTMLTableSectionElement | null) => {
    tbodyRef.current = el;
    setNodeRef(el);
  };

  const groupSelection =
    selection?.getGroupSelectionState(group);

  return (
    <div className="board-scroll-pane w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
      {isFetching && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Updating...
        </div>
      )}

      <table className="w-full min-w-[1200px] border-collapse">
        {showHeaders && (
          <thead className="sticky top-0 z-30 bg-background">
            <tr className="border">
              <th
                className="sticky left-0 z-30 w-1.5"
                style={{
                  backgroundColor: group.color,
                }}
              />

              <th className="sticky left-1.5 z-30 w-[200px] bg-background sm:w-[450px]">
                <div className="flex justify-end">
                  {!!selection && (
                    <Checkbox
                      className="mr-5"
                      checked={
                        groupSelection?.indeterminate
                          ? "indeterminate"
                          : groupSelection?.selected
                      }
                      onCheckedChange={() =>
                        selection.toggleGroup(group)
                      }
                    />
                  )}
                </div>
              </th>

              <SortableContext
                items={columns.map(
                  (column: any) => `column-${column.id}`,
                )}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column: any) => (
                  <Headers
                    key={column.id}
                    column={column}
                    members={members}
                    allColumns={columns}
                  />
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

        {/* SortableContext always receives ALL task ids so DND logic is unaffected */}
        <SortableContext
          items={rootTasks.map(
            (task: any) => `task-${task.id}`,
          )}
          strategy={verticalListSortingStrategy}
        >
          <tbody ref={setCombinedRef}>
            {/* Top spacer — fills the virtual space above visible rows */}
            {paddingTop > 0 && (
              <tr aria-hidden>
                <td colSpan={999} style={{ height: paddingTop }} />
              </tr>
            )}

            {(shouldVirtualize
              ? virtualItems.map((vRow) => rootTasks[vRow.index])
              : rootTasks
            ).map((task: any) => (
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

            {/* Bottom spacer — fills the virtual space below visible rows */}
            {paddingBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={999} style={{ height: paddingBottom }} />
              </tr>
            )}

            {/* Skeleton rows while next page loads — only for groups that still have tasks loading */}
            {isFetchingNextPage && !allTasksLoaded &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-border/40">
                  <td className="w-1.5 p-0" style={{ backgroundColor: group.color }} />
                  <td className="sticky left-1.5 z-20 w-[200px] bg-background px-3 py-2.5 sm:w-[450px]">
                    <Skeleton className={`h-3.5 ${(["w-48","w-36","w-56","w-28","w-44"])[i % 5]}`} />
                  </td>
                  {columns.map((col: any, ci: number) => (
                    <td key={col.id} className="border-l px-3 py-2.5" style={{ minWidth: 120 }}>
                      <Skeleton className={`h-3.5 ${(["w-16","w-20","w-12","w-24","w-14"])[ci % 5]}`} />
                    </td>
                  ))}
                  <td className="w-44" />
                </tr>
              ))
            }

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

        <GroupFooterRow
          tasks={(group.tasks ?? []).filter((t: any) => !t.parentId)}
          columns={columns}
          color={group.color}
          allTasksLoaded={allTasksLoaded}
          totalTaskCount={totalTaskCount ?? group._count?.tasks}
        />
      </table>
    </div>
  );
}

