"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getTask } from "@/services/tasks.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { useQuery } from "@tanstack/react-query";
import { TaskDetailsTabs } from "./TaskDetailTabs";
import { RecurrenceSelector } from "../RecurrenceSelector";

export function TaskDetailsSheet() {
  const { isOpen, close, context } = useTaskDetailsStore();
  const { boardId: inviteBoardId } = useInviteModalStore();
  const resolvedBoardId = context.boardId ?? inviteBoardId;

  const { data: task } = useQuery({
    queryKey: ["task", context.taskId, resolvedBoardId],
    queryFn: () => getTask(context.taskId!, resolvedBoardId!),
    enabled: !!context.taskId && !!resolvedBoardId,
  });

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("taskId", String(context.taskId));
    navigator.clipboard.writeText(url.toString()).then(() => {
      toast.success("Task link copied to clipboard");
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full p-0 sm:min-w-xl sm:w-auto">
        <SheetHeader className="relative flex flex-row items-start justify-between gap-3 border-b bg-card pb-4 pl-6 pr-14 pt-5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }}
          />
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Task</p>
            <SheetTitle className="mt-1 font-serif text-[28px] font-normal leading-tight tracking-tight">
              {task?.name}
            </SheetTitle>
          </div>
          {context.taskId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="mt-1 shrink-0 gap-1.5 text-xs text-muted-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
              Copy link
            </Button>
          )}
        </SheetHeader>
        {task?.id && (
          <RecurrenceSelector
            taskId={task.id}
            taskUpdatedAt={task.updatedAt}
            recurrenceType={task.recurrenceType ?? "NONE"}
            recurrenceInterval={task.recurrenceInterval ?? 1}
            recurrenceEndDate={task.recurrenceEndDate ?? null}
          />
        )}
        <TaskDetailsTabs task={task} />
      </SheetContent>
    </Sheet>
  );
}
