"use client";

import { useState, useMemo } from "react";
import {
  X, Search, Type, Hash, Calendar, CalendarRange, Tag, CheckSquare, Link2,
  Paperclip, AlignLeft, FileText, Plus, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField, FormFieldType } from "./board-feature-form.types";

/* ── Type → icon + style ─────────────────────────────────────────── */
const QUESTION_TYPES: {
  type: FormFieldType;
  boardColumnType: string;
  label: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  category: "data" | "selection" | "file" | "time" | "other";
}[] = [
  { type: "TEXT",      boardColumnType: "TEXT",      label: "Short text",  icon: Type,          bg: "#fff4e0", color: "#e08d00", category: "data" },
  { type: "LONG_TEXT", boardColumnType: "LONG_TEXT",  label: "Long text",   icon: AlignLeft,     bg: "#fff4e0", color: "#e08d00", category: "data" },
  { type: "NUMBER",    boardColumnType: "NUMBER",     label: "Number",      icon: Hash,          bg: "#fff4e0", color: "#e08d00", category: "data" },
  { type: "LINK",      boardColumnType: "LINK",       label: "Link",        icon: Link2,         bg: "#e0f5ff", color: "#0086c9", category: "other" },
  { type: "STATUS",    boardColumnType: "STATUS",     label: "Dropdown",    icon: Tag,           bg: "#e0f9ed", color: "#00a65e", category: "selection" },
  { type: "FILE",      boardColumnType: "FILE",       label: "File",        icon: Paperclip,     bg: "#ffe6e9", color: "#d62a40", category: "file" },
  { type: "DATE",      boardColumnType: "DATE",       label: "Date",        icon: Calendar,      bg: "#f3e8ff", color: "#9854cb", category: "time" },
  { type: "TIMELINE",  boardColumnType: "TIMELINE",   label: "Date range",  icon: CalendarRange, bg: "#f3e8ff", color: "#9854cb", category: "time" },
  { type: "CHECKBOX",  boardColumnType: "CHECKBOX",   label: "True / False",icon: CheckSquare,   bg: "#e0f5ff", color: "#0086c9", category: "other" },
];

const CATEGORY_LABELS: Record<string, string> = {
  data:      "Data input",
  selection: "Selection",
  file:      "File",
  time:      "Time",
  other:     "Other",
};

type Tab = "all" | "questions" | "board-columns" | "content";

interface AddContentModalProps {
  /** Whether the modal is open */
  open: boolean;
  onClose: () => void;
  /** All columns on the board */
  boardColumns: any[];
  /** Current form fields — used to mark which columns are already added */
  formFields: FormField[];
  /** Page index context — determines which page new fields go to */
  targetPageIndex: number;
  /** Can the user add a Page block? False when inside a page. */
  allowPage: boolean;
  /** Add a new question type (creates a new board column) */
  onAddQuestionType: (type: FormFieldType, boardColumnType: string, pageIndex: number) => void;
  /** Add an existing board column to the form */
  onAddBoardColumn: (column: any, pageIndex: number) => void;
  /** Add a new page */
  onAddPage: () => void;
}

type Selection =
  | { kind: "question"; type: FormFieldType; boardColumnType: string }
  | { kind: "board-column"; columnId: number }
  | { kind: "page" };

export function AddContentModal({
  open,
  onClose,
  boardColumns,
  formFields,
  targetPageIndex,
  allowPage,
  onAddQuestionType,
  onAddBoardColumn,
  onAddPage,
}: AddContentModalProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Reset state when modal opens */
  function handleOpen() {
    setSearch("");
    setSelected(new Set());
    setTab("all");
  }

  if (!open) return null;

  /* Board columns not yet in form (or hidden) */
  const visibleColumnIds = new Set(
    formFields.filter((f) => !f.hidden && f.columnId != null).map((f) => f.columnId),
  );

  const addableColumns = boardColumns.filter((col) => !visibleColumnIds.has(col.id));

  const q = search.toLowerCase().trim();

  const filteredQuestions = QUESTION_TYPES.filter(
    (qt) =>
      (tab === "all" || tab === "questions") &&
      (q === "" || qt.label.toLowerCase().includes(q)),
  );

  const filteredColumns = addableColumns.filter(
    (col) =>
      (tab === "all" || tab === "board-columns") &&
      (q === "" || (col.name ?? "").toLowerCase().includes(q)),
  );

  const showContent = tab === "all" || tab === "content";

  /* Build grouped question list */
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, typeof QUESTION_TYPES> = {};
    for (const qt of filteredQuestions) {
      if (!groups[qt.category]) groups[qt.category] = [];
      groups[qt.category].push(qt);
    }
    return groups;
  }, [filteredQuestions]);

  function toggleSelection(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAdd() {
    for (const key of selected) {
      if (key === "page") {
        onAddPage();
      } else if (key.startsWith("col:")) {
        const colId = Number(key.slice(4));
        const col = boardColumns.find((c) => c.id === colId);
        if (col) onAddBoardColumn(col, targetPageIndex);
      } else {
        const qt = QUESTION_TYPES.find((q) => q.type === key);
        if (qt) onAddQuestionType(qt.type, qt.boardColumnType, targetPageIndex);
      }
    }
    setSelected(new Set());
    onClose();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",           label: "All" },
    { id: "questions",     label: "Questions" },
    { id: "board-columns", label: "Board columns" },
    { id: "content",       label: "Content blocks" },
  ];

  /* Column type icon helper */
  function ColIcon({ type }: { type: string }) {
    switch (type.toUpperCase()) {
      case "TEXT":        return <Type className="h-3.5 w-3.5" style={{ color: "#e08d00" }} />;
      case "LONG_TEXT":   return <AlignLeft className="h-3.5 w-3.5" style={{ color: "#e08d00" }} />;
      case "NUMBER":      return <Hash className="h-3.5 w-3.5" style={{ color: "#e08d00" }} />;
      case "DATE":        return <Calendar className="h-3.5 w-3.5" style={{ color: "#9854cb" }} />;
      case "TIMELINE":    return <CalendarRange className="h-3.5 w-3.5" style={{ color: "#9854cb" }} />;
      case "STATUS":
      case "DROPDOWN":    return <Tag className="h-3.5 w-3.5" style={{ color: "#00a65e" }} />;
      case "CHECKBOX":    return <CheckSquare className="h-3.5 w-3.5" style={{ color: "#0086c9" }} />;
      case "LINK":        return <Link2 className="h-3.5 w-3.5" style={{ color: "#0086c9" }} />;
      case "FILE":        return <Paperclip className="h-3.5 w-3.5" style={{ color: "#d62a40" }} />;
      case "PERSON":      return <User className="h-3.5 w-3.5" style={{ color: "#0086c9" }} />;
      default:            return <Type className="h-3.5 w-3.5" style={{ color: "#888" }} />;
    }
  }

  function ColIconBg({ type }: { type: string }) {
    switch (type.toUpperCase()) {
      case "TEXT":
      case "LONG_TEXT":
      case "NUMBER":      return "#fff4e0";
      case "DATE":
      case "TIMELINE":    return "#f3e8ff";
      case "STATUS":
      case "DROPDOWN":    return "#e0f9ed";
      case "CHECKBOX":
      case "LINK":        return "#e0f5ff";
      case "FILE":        return "#ffe6e9";
      case "PERSON":      return "#e0f5ff";
      default:            return "#f0f0f0";
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative flex h-[540px] w-[680px] max-w-[96vw] overflow-hidden rounded-xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-3.5">
          <span className="text-sm font-semibold">Add content</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: left tabs + right content */}
        <div className="mt-[53px] flex flex-1 overflow-hidden">
          {/* Left tabs */}
          <div className="flex w-36 shrink-0 flex-col border-r bg-muted/20 py-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 py-2 text-left text-sm transition-colors",
                  tab === t.id
                    ? "bg-background font-medium text-foreground"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Search */}
            <div className="border-b px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  autoFocus
                />
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3">

              {/* Questions */}
              {Object.entries(groupedQuestions).map(([cat, items]) => (
                <section key={cat} className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((qt) => {
                      const key = qt.type;
                      const isChecked = selected.has(key);
                      const Icon = qt.icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSelection(key)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            isChecked
                              ? "border-primary bg-primary/5 font-medium text-primary"
                              : "border-transparent bg-muted/40 hover:bg-muted/80",
                          )}
                        >
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                            style={{ backgroundColor: qt.bg }}
                          >
                            <Icon className="h-3.5 w-3.5" style={{ color: qt.color }} />
                          </div>
                          <span className="flex-1 truncate">{qt.label}</span>
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              isChecked ? "border-primary bg-primary" : "border-input bg-background",
                            )}
                          >
                            {isChecked && (
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {/* Board columns */}
              {(tab === "all" || tab === "board-columns") && (
                <section className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Board columns
                  </p>
                  {filteredColumns.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                      All columns are already associated with questions
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {filteredColumns
                        .filter((col) =>
                          q === "" || (col.name ?? "").toLowerCase().includes(q),
                        )
                        .map((col) => {
                          const key = `col:${col.id}`;
                          const isChecked = selected.has(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleSelection(key)}
                              className={cn(
                                "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                isChecked
                                  ? "border-primary bg-primary/5 font-medium text-primary"
                                  : "border-transparent bg-muted/40 hover:bg-muted/80",
                              )}
                            >
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                                style={{ backgroundColor: ColIconBg({ type: col.type }) }}
                              >
                                <ColIcon type={col.type} />
                              </div>
                              <span className="flex-1 truncate">{col.name}</span>
                              <div
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  isChecked ? "border-primary bg-primary" : "border-input bg-background",
                                )}
                              >
                                {isChecked && (
                                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </section>
              )}

              {/* Content blocks */}
              {showContent && (
                <section className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Content blocks
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Page block */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => allowPage && toggleSelection("page")}
                        disabled={!allowPage}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          !allowPage
                            ? "cursor-not-allowed opacity-50 border-transparent bg-muted/30"
                            : selected.has("page")
                            ? "border-primary bg-primary/5 font-medium text-primary"
                            : "border-transparent bg-muted/40 hover:bg-muted/80",
                        )}
                        title={!allowPage ? "Cannot add a page block inside another page block." : "Add a new page"}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="flex-1 truncate">Page</span>
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            selected.has("page") && allowPage
                              ? "border-primary bg-primary"
                              : "border-input bg-background",
                          )}
                        >
                          {selected.has("page") && allowPage && (
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </section>
              )}

            </div>

            {/* Footer: Add button */}
            <div className="border-t px-4 py-3">
              <button
                type="button"
                onClick={handleAdd}
                disabled={selected.size === 0}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                  selected.size > 0
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-default bg-muted text-muted-foreground",
                )}
              >
                <Plus className="h-4 w-4" />
                {selected.size > 0
                  ? `Add to form (${selected.size})`
                  : "Add to form"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
