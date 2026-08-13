"use client";

import { useState } from "react";
import { FileText, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoardViewsTabsProps {
  board: any;
  children: React.ReactNode;
  formContent: React.ReactNode;
}

export function BoardViewsTabs({
  board,
  children,
  formContent,
}: BoardViewsTabsProps) {
  const [activeView, setActiveView] = useState<"table" | "form">("table");

  const hasForm = !!board?.form;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b">
        <div className="flex items-center border-b">
          <button
            type="button"
            className={`cursor-pointer relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "table"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("table")}
          >
            <Table2 className="h-4 w-4" />
            Main table
          </button>

          <button
            type="button"
            className={`cursor-pointer relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "form"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("form")}
          >
            <FileText className="h-4 w-4" />
            Form
          </button>
        </div>
      </div>

      {activeView === "table" ? children : formContent}
    </div>
  );
}
