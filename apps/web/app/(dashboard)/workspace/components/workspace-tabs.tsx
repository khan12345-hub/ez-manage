"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  FolderKanban,
  Lock,
  Settings,
  Users,
} from "lucide-react";

interface WorkspaceTabsProps {
  workspace: {
    boards: number;
    members: number;
  };
}

export function WorkspaceTabs({ workspace }: WorkspaceTabsProps) {
  return (
    <Tabs defaultValue="boards" className="mt-10">
      <TabsList className="h-12 bg-transparent p-0">
        <TabsTrigger value="boards">
          <FolderKanban className="mr-2 h-4 w-4" />
          Boards ({workspace.boards})
        </TabsTrigger>

        <TabsTrigger value="members">
          <Users className="mr-2 h-4 w-4" />
          Members ({workspace.members})
        </TabsTrigger>

        <TabsTrigger value="permissions">
          <Lock className="mr-2 h-4 w-4" />
          Permissions
        </TabsTrigger>

        <TabsTrigger value="activity">
          <Activity className="mr-2 h-4 w-4" />
          Activity
        </TabsTrigger>

        <TabsTrigger value="settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
