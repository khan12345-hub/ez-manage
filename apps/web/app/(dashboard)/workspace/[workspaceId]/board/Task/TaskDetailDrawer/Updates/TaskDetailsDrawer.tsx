"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getTask } from "@/services/tasks.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { useQuery } from "@tanstack/react-query";
import { TaskDetailsTabs } from "./TaskDetailTabs";

export function TaskDetailsSheet() {
  const { isOpen, close, context } = useTaskDetailsStore();
  const { boardId } = useInviteModalStore();

  const { data: task } = useQuery({
    queryKey: ["task", context.taskId],
    queryFn: () => getTask(context.taskId!, boardId!),
    enabled: !!context.taskId,
  });
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full p-0 sm:min-w-xl sm:w-auto">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-2xl font-semibold">
            {task?.name}
          </SheetTitle>
        </SheetHeader>
        <TaskDetailsTabs task={task} />
      </SheetContent>
    </Sheet>
  );
}
