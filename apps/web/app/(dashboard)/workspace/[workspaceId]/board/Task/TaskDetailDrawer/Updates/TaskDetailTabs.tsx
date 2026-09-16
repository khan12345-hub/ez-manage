"use client";

import { File, Home, History, Timer } from "lucide-react";

import { UpdatesTab } from "./UpdatesTab";
import { FilesTab } from "../Files/Filestab";
import { ActivityTab } from "../ActivityLogs/ActivityLogs";
import { TimeTrackingTab } from "../TimeTracking/TimeTrackingTab";
import { useInviteModalStore } from "@/store/invite-modal";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_TRIGGER_CLS =
  "cursor-pointer relative h-full rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none! transition-colors hover:text-foreground data-[state=active]:border-primary";

interface TaskDetailsTabsProps {
  task: any;
}

export function TaskDetailsTabs({ task }: TaskDetailsTabsProps) {
  const { boardId } = useInviteModalStore();

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="updates" className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-end border-b px-4">
          <TabsList className="h-full rounded-none bg-transparent p-0">
            <TabsTrigger value="updates" className={TAB_TRIGGER_CLS}>
              <Home className="h-4 w-4" />
              Updates
            </TabsTrigger>

            <TabsTrigger value="files" className={TAB_TRIGGER_CLS}>
              <File className="h-4 w-4" />
              Files
            </TabsTrigger>

            <TabsTrigger value="activity" className={TAB_TRIGGER_CLS}>
              <History className="h-4 w-4" />
              Activity Log
            </TabsTrigger>

            <TabsTrigger value="time" className={TAB_TRIGGER_CLS}>
              <Timer className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="updates" className="m-0 h-full">
            <UpdatesTab task={task} />
          </TabsContent>

          <TabsContent value="files" className="m-0 h-full">
            <FilesTab taskId={task?.id} />
          </TabsContent>

          <TabsContent value="activity" className="m-0 h-full">
            <ActivityTab task={task} />
          </TabsContent>

          <TabsContent value="time" className="m-0 h-full">
            {task?.id && boardId ? (
              <TimeTrackingTab taskId={task.id} boardId={boardId} />
            ) : null}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
