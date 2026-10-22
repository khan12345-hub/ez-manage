"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Clock, Activity } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { EmployeeTaskGroup, TaskSummary } from "@/services/ceo-assistant.api";
import { useCeoAssistantStore } from "@/store/ceo-assistant-store";

interface Props {
  employees: EmployeeTaskGroup[];
  activeFilter: string | null;
}

function TaskBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", color)}>
      {count} {label}
    </span>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const isOverdue = task.categories.includes("overdue");
  const isDueSoon = task.categories.includes("due_soon");

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{task.taskName}</span>
          {task.status && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: task.statusColor ?? "#64748b" }}
            >
              {task.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{task.boardName} · {task.groupName}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {isOverdue && task.daysOverdue !== null && (
          <span className="text-xs font-semibold text-red-500">{task.daysOverdue}d overdue</span>
        )}
        {isDueSoon && !isOverdue && task.dueDate && (
          <span className="text-xs font-medium text-amber-500">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {!isOverdue && !isDueSoon && (
          <span className="text-xs text-muted-foreground">Inactive</span>
        )}
      </div>
    </div>
  );
}

function EmployeeRow({ group, activeFilter }: { group: EmployeeTaskGroup; activeFilter: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedEmployeeIds, toggleEmployee } = useCeoAssistantStore();
  const isSelected = selectedEmployeeIds.has(group.user.id);

  const filteredOverdue = activeFilter === "due_soon" || activeFilter === "inactive" ? [] : group.overdue;
  const filteredDueSoon = activeFilter === "overdue" || activeFilter === "inactive" ? [] : group.dueSoon;
  const filteredInactive = activeFilter === "overdue" || activeFilter === "due_soon" ? [] : group.inactive;

  const allTasks = [
    ...(activeFilter === null || activeFilter === "overdue" ? group.overdue : []),
    ...(activeFilter === null || activeFilter === "due_soon" ? group.dueSoon : []),
    ...(activeFilter === null || activeFilter === "inactive" ? group.inactive : []),
  ];

  const uniqueTasks = [...new Map(allTasks.map((t) => [t.taskId, t])).values()];

  if (
    (activeFilter === "overdue" && group.overdue.length === 0) ||
    (activeFilter === "due_soon" && group.dueSoon.length === 0) ||
    (activeFilter === "inactive" && group.inactive.length === 0)
  ) {
    return null;
  }

  const initials = `${group.user.firstName[0] ?? ""}${group.user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer select-none",
          "hover:bg-muted/40 transition-colors",
          isSelected && "bg-blue-50 dark:bg-blue-950/20",
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleEmployee(group.user.id)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />

        <div
          className="flex flex-1 items-center gap-3 min-w-0"
          onClick={() => setExpanded((p) => !p)}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={group.user.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">
              {group.user.firstName} {group.user.lastName}
            </div>
            <div className="text-xs text-muted-foreground truncate">{group.user.email}</div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <TaskBadge label="overdue" count={group.overdue.length} color="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" />
            <TaskBadge label="due soon" count={group.dueSoon.length} color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
            <TaskBadge label="inactive" count={group.inactive.length} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
          </div>

          <button className="ml-2 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t divide-y bg-background">
          {uniqueTasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No tasks match the current filter.</p>
          ) : (
            uniqueTasks.map((task) => <TaskRow key={task.taskId} task={task} />)
          )}
        </div>
      )}
    </div>
  );
}

export function EmployeeList({ employees, activeFilter }: Props) {
  const { selectedEmployeeIds, selectAllEmployees, clearSelectedEmployees } = useCeoAssistantStore();
  const allSelected = employees.length > 0 && employees.every((e) => selectedEmployeeIds.has(e.user.id));

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No flagged employees found with the current filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) =>
            checked ? selectAllEmployees(employees.map((e) => e.user.id)) : clearSelectedEmployees()
          }
        />
        <span className="text-xs font-medium text-muted-foreground">
          {selectedEmployeeIds.size > 0
            ? `${selectedEmployeeIds.size} selected`
            : `Select all (${employees.length})`}
        </span>
      </div>
      {employees.map((group) => (
        <EmployeeRow key={group.user.id} group={group} activeFilter={activeFilter} />
      ))}
    </div>
  );
}
