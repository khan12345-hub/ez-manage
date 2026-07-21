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
      <SheetContent side="right" className="w-130 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-2xl font-semibold">
            {task?.name}
          </SheetTitle>
        </SheetHeader>

        {/* <div className="space-y-6 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p>{task?.status}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Priority</p>
            <p>{task?.priority}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Assignee</p>
            <p>{task?.assignee?.name ?? "-"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Description</p>

            <div className="mt-2 rounded-md border p-3">
              {task?.description || "No description"}
            </div>
          </div>
        </div> */}
      </SheetContent>
    </Sheet>
  );
}
