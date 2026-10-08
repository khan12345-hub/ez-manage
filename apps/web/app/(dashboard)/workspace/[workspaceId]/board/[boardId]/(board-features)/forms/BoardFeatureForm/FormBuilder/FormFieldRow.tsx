"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  Type,
  Hash,
  Calendar,
  CalendarRange,
  Tag,
  CheckSquare,
  Link,
  Paperclip,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField, FormFieldType } from "./board-feature-form.types";

interface TypeConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  bg: string;
  color: string;
  label: string;
}

const TYPE_CONFIG: Record<FormFieldType, TypeConfig> = {
  TEXT:     { icon: Type,          bg: "#fff4e0", color: "#e08d00", label: "Text" },
  NUMBER:   { icon: Hash,          bg: "#fff4e0", color: "#e08d00", label: "Number" },
  DATE:     { icon: Calendar,      bg: "#f3e8ff", color: "#9854cb", label: "Date" },
  TIMELINE: { icon: CalendarRange, bg: "#f3e8ff", color: "#9854cb", label: "Timeline" },
  STATUS:   { icon: Tag,           bg: "#e0f9ed", color: "#00a65e", label: "Status" },
  CHECKBOX: { icon: CheckSquare,   bg: "#e0f5ff", color: "#0086c9", label: "Checkbox" },
  LINK:     { icon: Link,          bg: "#e0f5ff", color: "#0086c9", label: "Link" },
  FILE:     { icon: Paperclip,     bg: "#ffe6e9", color: "#d62a40", label: "File" },
};

interface FormFieldRowProps {
  field: FormField;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  onToggleRequired: () => void;
  children?: React.ReactNode; // expanded settings panel
}

export function FormFieldRow({
  field,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onToggleVisible,
  onToggleRequired,
  children,
}: FormFieldRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const config = TYPE_CONFIG[field.type] ?? TYPE_CONFIG.TEXT;
  const Icon = config.icon;
  const isHidden = field.hidden ?? false;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        onClick={onSelect}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer select-none transition-colors",
          isDragging && "opacity-40",
          isSelected ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-muted/50",
        )}
      >
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Type icon */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: config.bg }}
          title={config.label}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
        </div>

        {/* Name */}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium",
            isHidden ? "text-muted-foreground/60" : "text-foreground",
          )}
        >
          {field.name || config.label}
          {field.required && !isHidden && (
            <span className="ml-0.5 text-destructive">*</span>
          )}
        </span>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Required toggle — only for visible fields */}
          {!isHidden && (
            <button
              type="button"
              title={field.required ? "Required — click to make optional" : "Optional — click to make required"}
              onClick={(e) => { e.stopPropagation(); onToggleRequired(); }}
              className={cn(
                "rounded px-1 py-0.5 text-xs font-bold transition-colors",
                field.required
                  ? "text-destructive hover:text-destructive/70"
                  : "text-muted-foreground/40 hover:text-muted-foreground",
              )}
            >
              *
            </button>
          )}

          {/* Eye toggle */}
          <button
            type="button"
            title={isHidden ? "Show on form" : "Hide from form"}
            onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
            className={cn(
              "rounded p-1 transition-colors",
              isHidden
                ? "text-muted-foreground/30 hover:text-muted-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isHidden
              ? <EyeOff className="h-3.5 w-3.5" />
              : <Eye className="h-3.5 w-3.5" />
            }
          </button>

          {/* Expand for settings (description + STATUS options) */}
          {isSelected && (
            <button
              type="button"
              title="Field settings"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Expanded settings */}
      {isSelected && isExpanded && children && (
        <div className="ml-10 mr-2 mb-1 rounded-lg border bg-muted/30 p-3">
          {children}
        </div>
      )}
    </div>
  );
}
