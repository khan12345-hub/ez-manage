"use client";

import { useState } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";

import { GeneralTabs } from "./general/GeneralTabs";
import { OverviewTab } from "./general/OverviewTab";
import { UsersTab } from "./general/UsersTab";
import { WorkspacesTab } from "./general/WorkspacesTab";
import { BoardsTab } from "./general/BoardsTab";
import { MediaTab } from "./general/MediaTab";

export type ManagementTab =
  | "overview"
  | "users"
  | "workspaces"
  | "boards"
  | "media";

export function GeneralSettings() {
  const [activeTab, setActiveTab] =
    useState<ManagementTab>("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          General
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, workspaces, boards and system resources.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as ManagementTab)
        }
      >
        <GeneralTabs />

        <div className="mt-6">
          
        </div>
      </Tabs>
    </div>
  );
}

