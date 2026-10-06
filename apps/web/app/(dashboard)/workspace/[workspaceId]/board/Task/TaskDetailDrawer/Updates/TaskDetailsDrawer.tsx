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
  const { boardId } = useInviteModalStore();

  const { data: task } = useQuery({
    queryKey: ["task", context.taskId],
    queryFn: () => getTask(context.taskId!, boardId!),
    enabled: !!context.taskId,
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
        <SheetHeader className="flex flex-row items-center justify-between border-b px-6 py-5">
          <SheetTitle className="text-2xl font-semibold">
            {task?.name}
          </SheetTitle>
          {context.taskId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0 gap-1.5 text-xs text-muted-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
              Copy link
            </Button>
          )}
        </SheetHeader>
        {task?.id && (
          <RecurrenceSelector
            taskId={task.id}
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
