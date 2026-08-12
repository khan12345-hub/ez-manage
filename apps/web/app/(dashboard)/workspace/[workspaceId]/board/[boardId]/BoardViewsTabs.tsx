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
        <Button
          variant="ghost"
          className={
            activeView === "table"
              ? "rounded-none border!  border-primary! border-b-2!"
              : "rounded-none"
          }
          onClick={() => setActiveView("table")}
        >
          <Table2 className="mr-2 h-4 w-4" />
          Main table
        </Button>

          <Button
            variant="ghost"
            className={
              activeView === "form"
                ? "rounded-none border-b-2 border-primary"
                : "rounded-none"
            }
            onClick={() => setActiveView("form")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Form
          </Button>
        
      </div>

      {activeView === "table" ? children : formContent}
    </div>
  );
}