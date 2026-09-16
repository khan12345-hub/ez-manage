"use client";

import { useState } from "react";
import { FileText, Table2, Files, Kanban, CalendarDays, BarChart2, GanttChart } from "lucide-react";
import { KanbanView } from "./views/KanbanView";
import { CalendarView } from "./views/CalendarView";
import { ChartView } from "./views/ChartView";
import { GanttView } from "./views/GanttView";

type ViewType = "table" | "form" | "documents" | "files" | "kanban" | "calendar" | "chart" | "gantt";

interface BoardViewsTabsProps {
  board: any;
  children: React.ReactNode;
  formContent: React.ReactNode;
  documentContent: React.ReactNode;
  fileGalleryContent: React.ReactNode;
}

const TABS: { id: ViewType; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: "table",    label: "Main table",   shortLabel: "Table",    icon: Table2 },
  { id: "kanban",   label: "Kanban",       shortLabel: "Kanban",   icon: Kanban },
  { id: "calendar", label: "Calendar",     shortLabel: "Cal",      icon: CalendarDays },
  { id: "chart",    label: "Chart",        shortLabel: "Chart",    icon: BarChart2 },
  { id: "gantt",    label: "Gantt",        shortLabel: "Gantt",    icon: GanttChart },
  { id: "form",     label: "Form",         shortLabel: "Form",     icon: FileText },
  { id: "documents",label: "Documents",    shortLabel: "Docs",     icon: Files },
  { id: "files",    label: "File Gallery", shortLabel: "Files",    icon: Files },
];

export function BoardViewsTabs({
  board,
  children,
  formContent,
  documentContent,
  fileGalleryContent,
}: BoardViewsTabsProps) {
  const [activeView, setActiveView] = useState<ViewType>("table");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border-b">
        <div className="flex min-w-max items-center">
          {TABS.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`relative flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:gap-2 ${
                activeView === id
                  ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveView(id)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden text-xs">{shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {activeView === "table"    && children}
      {activeView === "kanban"   && <KanbanView board={board} />}
      {activeView === "calendar" && <CalendarView board={board} />}
      {activeView === "chart"    && <ChartView board={board} />}
      {activeView === "gantt"    && <GanttView board={board} />}
      {activeView === "form"     && formContent}
      {activeView === "documents"&& documentContent}
      {activeView === "files"    && fileGalleryContent}
    </div>
  );
}
