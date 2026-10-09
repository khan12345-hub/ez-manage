"use client";

import { useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";

import { useGroupStore } from "@/store/create-group-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { STATUS_COLORS } from "@/constants/colors";

import {
  createGroup,
  updateGroup as updateGroupApi,
} from "@/services/groups.api";

import { GroupActions } from "./GroupActions";

// ── collapsed summary helpers ─────────────────────────────────────────────────

function getStoredAgg(columnId: number): string {
  try { return localStorage.getItem(`footer-agg-${columnId}`) || "none"; }
  catch { return "none"; }
}

function computeCollapsedSummary(tasks: any[], column: any): string | null {
  const agg = getStoredAgg(column.id);
  if (agg === "none") return null;

  const cells = tasks.flatMap((t: any) =>
    (t.cells ?? []).filter((c: any) => c.columnId === column.id),
  );

  if (agg === "count") {
    const n = cells.filter((c: any) => {
      if (column.type === "CHECKBOX") return true;
      const v = c.value;
      if (v == null || v === "") return false;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    }).length;
    return `${n} (count)`;
  }

  if (["sum", "avg", "min", "max"].includes(agg)) {
    const nums = cells
      .map((c: any) => parseFloat(String(c.value?.text ?? c.value ?? "").replace(/[$,]/g, "")))
      .filter((n: number) => !isNaN(n));
    if (!nums.length) return null;
    let result: number;
    if (agg === "sum") result = nums.reduce((a: number, b: number) => a + b, 0);
    else if (agg === "avg") result = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
    else if (agg === "min") result = Math.min(...nums);
    else result = Math.max(...nums);
    const isPrice = column.type === "PRICE";
    const display = isPrice
      ? `$${result.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : (result % 1 === 0 ? result.toLocaleString() : result.toFixed(2));
    return `${display} (${agg})`;
  }

  return null;
}

interface Props {
  group: any;
  focusToken?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddGroup?: () => void;
  taskCount?: number;
  completedTaskCount?: number;
  tasks?: any[];
  columns?: any[];
}

export function GroupHeader({
  group,
  focusToken = 0,
  isCollapsed = false,
  onToggleCollapse,
  onAddGroup,
  taskCount,
  completedTaskCount,
  tasks = [],
  columns = [],
}: Props) {
  /*
   * IMPORTANT:
   * Subscribe to the actual group in Zustand.
   *
   * The `group` prop may be stale because it can come from
   * React Query / board API data.
   */
  const currentGroup = useGroupStore((state) =>
    state.groups.find((item) => item.id === group.id),
  );

  const updateGroup = useGroupStore((state) => state.updateGroup);
  const removeGroup = useGroupStore((state) => state.removeGroup);

  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Fallback to prop while Zustand is initializing.
   */
  const activeGroup = currentGroup ?? group;

  // Compute summary chips for collapsed state (only non-primary columns with a stored agg)
  const collapsedSummaries = useMemo(() => {
    if (!isCollapsed || !columns.length || !tasks.length) return [];
    return columns
      .filter((col: any) => !col.isPrimary)
      .map((col: any) => {
        const display = computeCollapsedSummary(tasks, col);
        return display ? { name: col.name, display } : null;
      })
      .filter(Boolean) as { name: string; display: string }[];
  }, [isCollapsed, columns, tasks]);

  useEffect(() => {
    if (activeGroup.isNew && inputRef.current) {
      inputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activeGroup.isNew, focusToken]);

  /*
   * Create group
   */
  const createMutation = useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: number;
      data: {
        name: string;
        color?: string;
      };
    }) => createGroup(boardId, data),

    onSuccess: () => {
      removeGroup(activeGroup.id);

      if (boardId) {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      }
    },
  });

  /*
   * Update group
   */
  const updateMutation = useMutation({
    mutationFn: ({
      boardId,
      groupId,
      name,
      color,
    }: {
      boardId: number;
      groupId: number;
      name?: string;
      color?: string;
    }) =>
      updateGroupApi(boardId, groupId, {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
      }),

    onSuccess: (updatedGroup, variables) => {
      /*
       * Keep Zustand synchronized with the backend.
       */
      updateGroup(variables.groupId, {
        ...(updatedGroup?.name !== undefined
          ? { name: updatedGroup.name }
          : variables.name !== undefined
            ? { name: variables.name }
            : {}),

        ...(updatedGroup?.color !== undefined
          ? { color: updatedGroup.color }
          : variables.color !== undefined
            ? { color: variables.color }
            : {}),
      });
    },
  });

  const handleColorChange = (color: string) => {
    /*
     * Optimistic UI update.
     * Because activeGroup comes from Zustand, this immediately
     * rerenders the ColorPicker and button.
     */
    updateGroup(activeGroup.id, {
      color,
    });

    if (activeGroup.isNew || !boardId) {
      return;
    }

    updateMutation.mutate({
      boardId,
      groupId: Number(activeGroup.id),
      color,
    });
  };

  const handleNameChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    /*
     * Update Zustand on every keystroke.
     */
    updateGroup(activeGroup.id, {
      name: event.target.value,
    });
  };

  const handleNameBlur = () => {
    if (!boardId) return;

    const name = activeGroup.name.trim();

    /*
     * Remove empty temporary group.
     */
    if (!name) {
      if (activeGroup.isNew) {
        removeGroup(activeGroup.id);
      } else {
        updateGroup(activeGroup.id, {
          isEditing: false,
        });
      }

      return;
    }

    /*
     * Create temporary group.
     */
    if (activeGroup.isNew) {
      createMutation.mutate({
        boardId,
        data: {
          name,
          color: activeGroup.color ?? undefined,
        },
      });

      return;
    }

    /*
     * Save existing group.
     */
    updateMutation.mutate({
      boardId,
      groupId: Number(activeGroup.id),
      name,
    });
  };

  return (
    <div className="border-b">
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-3">
        <ColorPicker
          value={activeGroup.color ?? undefined}
          colors={STATUS_COLORS}
          onChange={handleColorChange}
        >
          <button
            type="button"
            className="h-8 w-8 shrink-0 rounded-md border transition hover:scale-105"
            style={{
              backgroundColor: activeGroup.color ?? undefined,
            }}
            aria-label="Change group color"
          />
        </ColorPicker>

        <Input
          ref={inputRef}
          value={activeGroup.name ?? ""}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className="w-64 border-none p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          style={{
            color: activeGroup.color ?? undefined,
          }}
        />

        {taskCount !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {taskCount} {taskCount === 1 ? "item" : "items"}
          </span>
        )}

        {completedTaskCount !== undefined && taskCount !== undefined && taskCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.round((completedTaskCount / taskCount) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {completedTaskCount}/{taskCount} done
            </span>
          </div>
        )}
      </div>

      {!activeGroup.isNew && (
        <GroupActions
          group={activeGroup}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse ?? (() => {})}
          onAddGroup={onAddGroup ?? (() => {})}
        />
      )}
    </div>

    {/* Collapsed summary strip */}
    {isCollapsed && collapsedSummaries.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
        {collapsedSummaries.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs"
          >
            <span className="font-medium text-muted-foreground">{s.name}:</span>
            <span className="font-semibold text-foreground">{s.display}</span>
          </div>
        ))}
      </div>
    )}
  </div>
  );
}



