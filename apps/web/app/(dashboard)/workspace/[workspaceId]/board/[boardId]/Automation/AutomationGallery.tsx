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
      <div className="flex h-[72px] shrink-0 items-center border-b px-5">
        {/* Board / title */}
        <div className="min-w-[300px] text-[16px]">
          <span className="font-semibold">
            Automations
          </span>{" "}
          <span className="text-muted-foreground">
            {boardName}
          </span>
        </div>

        {/* Tabs */}
        <div className="mx-auto flex h-[34px] overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() =>
              setActiveTab("create")
            }
            className={`
              min-w-[120px]
              border-r
              px-6
              text-sm
              font-medium
              transition
              ${
                activeTab === "create"
                  ? "bg-blue-50 text-blue-600"
                  : "text-muted-foreground hover:bg-muted"
              }
            `}
          >
            Create
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("manage")
            }
            className={`
              min-w-[120px]
              px-6
              text-sm
              font-medium
              transition
              ${
                activeTab === "manage"
                  ? "bg-blue-50 text-blue-600"
                  : "text-muted-foreground hover:bg-muted"
              }
            `}
          >
            Manage
          </button>
        </div>

        {/* Right spacer */}
        <div className="ml-auto min-w-[300px]" />
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