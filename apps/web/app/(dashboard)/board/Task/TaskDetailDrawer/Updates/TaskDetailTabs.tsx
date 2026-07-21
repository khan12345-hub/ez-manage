"use client";

import {
  File,
  Home,
  Plus,
  MessageSquare,
  History,
} from "lucide-react";

import { useState } from "react";

import { UpdatesTab } from "./UpdatesTab";
import { FilesTab } from "./FilesTab";
import { ActivityTab } from "./ActivityTab";

interface TaskDetailsTabsProps {
  task: any;
  boardId: number;
}

type Tab = "updates" | "files" | "activity";

export function TaskDetailsTabs({
  task,
  boardId,
}: TaskDetailsTabsProps) {
  const [activeTab, setActiveTab] =
    useState<Tab>("updates");

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex h-12 items-center border-b px-4">
        <TabButton
          active={activeTab === "updates"}
          onClick={() =>
            setActiveTab("updates")
          }
          icon={<Home className="h-4 w-4" />}
        >
          Updates
        </TabButton>

        <TabButton
          active={activeTab === "files"}
          onClick={() =>
            setActiveTab("files")
          }
          icon={<File className="h-4 w-4" />}
        >
          Files
        </TabButton>

        <TabButton
          active={activeTab === "activity"}
          onClick={() =>
            setActiveTab("activity")
          }
          icon={
            <History className="h-4 w-4" />
          }
        >
          Activity Log
        </TabButton>

        <button
          type="button"
          className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "updates" && (
          <UpdatesTab
            task={task}
            boardId={boardId}
          />
        )}

        {activeTab === "files" && (
          <FilesTab
            task={task}
            boardId={boardId}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTab
            task={task}
            boardId={boardId}
          />
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex h-full items-center gap-2 px-3",
        "text-sm font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {icon}

      {children}

      {active && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
      )}
    </button>
  );
}