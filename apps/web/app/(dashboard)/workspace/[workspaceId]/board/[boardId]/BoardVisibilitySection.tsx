"use client";

import {
  Check,
  Globe,
  Lock,
} from "lucide-react";

import type { BoardVisibility } from "@/services/board-access-management.api";

interface BoardVisibilitySectionProps {
  visibility: BoardVisibility;

  onChange?: (
    visibility: BoardVisibility,
  ) => void;

  disabled?: boolean;
}

export function BoardVisibilitySection({
  visibility,
  onChange,
  disabled = false,
}: BoardVisibilitySectionProps) {
  return (
    <div className="px-6 py-5">
      <div className="mb-3">
        <h3 className="text-sm font-medium">
          Board visibility
        </h3>

        <p className="text-sm text-muted-foreground">
          Control who can access this board.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <VisibilityOption
          active={visibility === "PRIVATE"}
          disabled={disabled}
          icon={
            <Lock className="h-4 w-4" />
          }
          title="Private"
          description="Only members of this board can access it."
          onClick={() =>
            onChange?.("PRIVATE")
          }
        />

        <VisibilityOption
          active={visibility === "PUBLIC"}
          disabled={disabled}
          icon={
            <Globe className="h-4 w-4" />
          }
          title="Public"
          description="Anyone with access to the workspace can view it."
          onClick={() =>
            onChange?.("PUBLIC")
          }
        />
      </div>
    </div>
  );
}

interface VisibilityOptionProps {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function VisibilityOption({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: VisibilityOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-primary/5"
          : "hover:bg-muted/50"
      } ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : ""
      }`}
    >
      <div className="mt-0.5">
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {title}
          </span>

          {active && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}