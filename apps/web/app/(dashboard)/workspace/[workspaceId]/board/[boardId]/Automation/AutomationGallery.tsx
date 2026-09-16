"use client";

import { useState } from "react";

import AutomationCreateTab from "./AutomationCreateTab/AutomationCreateTab";
import AutomationManageTab from "./AutomationManageTab/AutomationManageTab";

type AutomationGalleryProps = {
  boardId: number;
  boardName: string;

  onClose: () => void;

  onCreateFromScratch: () => void;

  onUseTemplate: (templateId: string) => void;

  onEditAutomation?: (automationId: number) => void;
};

type AutomationTab = "create" | "manage";

export default function AutomationGallery({
  boardId,
  boardName,
  onClose,
  onCreateFromScratch,
  onUseTemplate,
  onEditAutomation,
}: AutomationGalleryProps) {
  const [activeTab, setActiveTab] =
    useState<AutomationTab>("create");

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex min-h-[56px] shrink-0 items-center gap-3 border-b px-4 py-3 sm:h-[72px] sm:px-5">
        {/* Board / title */}
        <div className="min-w-0 flex-1 text-sm sm:text-[16px]">
          <span className="font-semibold">Automations</span>{" "}
          <span className="hidden text-muted-foreground sm:inline">{boardName}</span>
        </div>

        {/* Tabs */}
        <div className="flex h-[34px] shrink-0 overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`
              border-r px-4 text-sm font-medium transition sm:px-6
              ${activeTab === "create" ? "bg-blue-50 text-blue-600" : "text-muted-foreground hover:bg-muted"}
            `}
          >
            Create
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={`
              px-4 text-sm font-medium transition sm:px-6
              ${activeTab === "manage" ? "bg-blue-50 text-blue-600" : "text-muted-foreground hover:bg-muted"}
            `}
          >
            Manage
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1">
        {activeTab === "create" ? (
          <AutomationCreateTab
            onCreateFromScratch={
              onCreateFromScratch
            }
            onUseTemplate={
              onUseTemplate
            }
          />
        ) : (
          <AutomationManageTab
            boardId={boardId}
            onEditAutomation={(
              automationId,
            ) => {
              onEditAutomation?.(
                automationId,
              );
            }}
          />
        )}
      </div>
    </div>
  );
}