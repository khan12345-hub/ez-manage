"use client";

import { File, Home, Plus, History } from "lucide-react";

import { UpdatesTab } from "./UpdatesTab";
import { FilesTab } from "../Files/Filestab";
import { ActivityTab } from "../ActivityLogs/ActivityLogs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskDetailsTabsProps {
  task: any;
}

export function TaskDetailsTabs({ task }: TaskDetailsTabsProps) {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="updates" className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-end border-b px-4">
          <TabsList className="h-full rounded-none bg-transparent p-0">
            <TabsTrigger
              value="updates"
              className="relative h-full rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary"
            >
              <Home className="h-4 w-4" />
              Updates
            </TabsTrigger>

            <TabsTrigger
              value="files"
              className="relative h-full rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary"
            >
              <File className="h-4 w-4" />
              Files
            </TabsTrigger>

            <TabsTrigger
              value="activity"
              className="relative h-full rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary"
            >
              <History className="h-4 w-4" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <button
            type="button"
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="updates" className="m-0 h-full">
            <UpdatesTab task={task} />
          </TabsContent>

          <TabsContent value="files" className="m-0 h-full">
            <FilesTab task={task} />
          </TabsContent>

          <TabsContent value="activity" className="m-0 h-full">
            <ActivityTab task={task} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
