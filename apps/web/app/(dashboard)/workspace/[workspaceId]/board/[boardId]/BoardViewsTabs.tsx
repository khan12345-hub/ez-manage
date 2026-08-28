"use client";

import { useState } from "react";

import { FileText, Table2, Files } from "lucide-react";

interface BoardViewsTabsProps {
  board: any;
  children: React.ReactNode;
  formContent: React.ReactNode;
  documentContent: React.ReactNode;
  fileGalleryContent: React.ReactNode;
}

export function BoardViewsTabs({
  board,
  children,
  formContent,
  documentContent,
  fileGalleryContent,
}: BoardViewsTabsProps) {
  const [activeView, setActiveView] = useState<
    "table" | "form" | "documents" | "files"
  >("table");

  // const hasForm = !!board?.form;

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b">
        <div className="flex items-center">
          {/* Main table */}
          <button
            type="button"
            className={`relative flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "table"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("table")}
          >
            <Table2 className="h-4 w-4" />
            Main table
          </button>

          {/* Form */}
          <button
            type="button"
            className={`relative flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "form"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("form")}
          >
            <FileText className="h-4 w-4" />
            Form
          </button>

          {/* Documents */}
          <button
            type="button"
            className={`relative flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "documents"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("documents")}
          >
            <Files className="h-4 w-4" />
            Documents
          </button>

          {/* Files */}
          <button
            type="button"
            className={`relative flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeView === "files"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveView("files")}
          >
            <Files className="h-4 w-4" />
            File Gallery
          </button>
        </div>
      </div>

      {/* Main table */}
      {activeView === "table" && children}

      {/* Form */}
      {activeView === "form" && formContent}

      {/* Documents */}
      {activeView === "documents" && documentContent}

      {/* File Gallery */}
      {activeView === "files" && fileGalleryContent}
    </div>
  );
}
