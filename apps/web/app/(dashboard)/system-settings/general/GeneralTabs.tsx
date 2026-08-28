
"use client";

import {
  BarChart3,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "users",
    label: "Users",
    icon: Users,
  },
  {
    id: "workspaces",
    label: "Workspaces",
    icon: FolderKanban,
  },
  {
    id: "boards",
    label: "Boards",
    icon: BarChart3,
  },
  {
    id: "media",
    label: "Media",
    icon: HardDrive,
  },
] as const;

export function GeneralTabs() {
  return (
    <div className="overflow-x-auto">
      <TabsList className="h-10 w-max justify-start bg-muted/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 px-4"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}

