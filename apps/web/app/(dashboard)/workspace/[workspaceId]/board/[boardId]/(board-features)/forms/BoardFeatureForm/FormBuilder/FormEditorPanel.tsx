"use client";

import { useState } from "react";
import {
  Plus, Trash2,
  Type, Hash, Calendar, CalendarRange, Tag, CheckSquare, Link2, Paperclip,
  Upload, Check, AlignLeft, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { FormBuilderState, FormField, FormFieldType, FormPage } from "./board-feature-form.types";
import { SYSTEM_COLUMN_TYPES } from "./board-form.utils";
import { StatusOptionEditor } from "../../StatusOptionEditor";
import { AddContentModal } from "./AddContentModal";
import { useColumnRename } from "../../../../../group/columns/useColumnRename.hooks";

/* ── Type → icon + color config ───────────────────────────────────── */
interface TypeConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  bg: string;
  color: string;
  label: string;
}

const TYPE_CONFIG: Partial<Record<FormFieldType, TypeConfig>> & { _default: TypeConfig } = {
  TEXT:      { icon: Type,          bg: "#fff4e0", color: "#e08d00", label: "Text" },
  LONG_TEXT: { icon: AlignLeft,     bg: "#fff4e0", color: "#e08d00", label: "Long Text" },
  NUMBER:    { icon: Hash,          bg: "#fff4e0", color: "#e08d00", label: "Number" },
  DATE:      { icon: Calendar,      bg: "#f3e8ff", color: "#9854cb", label: "Date" },
  TIMELINE:  { icon: CalendarRange, bg: "#f3e8ff", color: "#9854cb", label: "Timeline" },
  STATUS:    { icon: Tag,           bg: "#e0f9ed", color: "#00a65e", label: "Status" },
  CHECKBOX:  { icon: CheckSquare,   bg: "#e0f5ff", color: "#0086c9", label: "Checkbox" },
  LINK:      { icon: Link2,         bg: "#e0f5ff", color: "#0086c9", label: "Link" },
  FILE:      { icon: Paperclip,     bg: "#ffe6e9", color: "#d62a40", label: "File Upload" },
  _default:  { icon: Type,          bg: "#f0f0f0", color: "#888888", label: "Field" },
};

function getConfig(type: FormFieldType): TypeConfig {
  return (TYPE_CONFIG as any)[type] ?? TYPE_CONFIG._default;
}

function TypeIcon({ type, className }: { type: FormFieldType; className?: string }) {
  const cfg = getConfig(type);
  const Icon = cfg.icon;
  return (
    <div
      className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", className)}
      style={{ backgroundColor: cfg.bg }}
    >
      <Icon className="h-4 w-4" style={{ color: cfg.color }} />
    </div>
  );
}

/* ── Props ──────────────────────────────────────────────────────────── */
interface FormEditorPanelProps {
  form: FormBuilderState;
  selectedFieldId: string | null;
  boardId: number;
  board: any;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: FormField) => void;
  onToggleVisible: (id: string) => void;
  onToggleRequired: (id: string) => void;
  onAddField: (type: FormFieldType, boardColumnType: string, pageIndex: number) => void;
  onAddBoardColumn: (column: any, pageIndex: number) => void;
  onRemoveField: (fieldId: string, deleteColumn: boolean) => void;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onUpdatePage: (pageId: string, data: Partial<FormPage>) => void;
  onThankyouChange: (title: string, message: string) => void;
}

export function FormEditorPanel({
  form,
  selectedFieldId,
  boardId,
  board,
  onSelectField,
  onUpdateField,
  onToggleVisible,
  onToggleRequired,
  onAddField,
  onAddBoardColumn,
  onRemoveField,
  onNameChange,
  onDescriptionChange,
  onAddPage,
  onRemovePage,
  onUpdatePage,
  onThankyouChange,
}: FormEditorPanelProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ field: FormField; deleteColumn: boolean } | null>(null);
  const [addModal, setAddModal] = useState<{ pageIndex: number; allowPage: boolean } | null>(null);
  const [editingThankyou, setEditingThankyou] = useState(false);
  const [thankyouTitle, setThankyouTitle] = useState(form.thankyouTitle ?? "Thank you!");
  const [thankyouMsg, setThankyouMsg] = useState(form.thankyouMessage ?? "We've received your response.");

  const pages = form.pages.length > 0 ? form.pages : [{ id: "default", title: "Page 1" }];

  /* Fields grouped by pageIndex */
  function getPageFields(pageIndex: number) {
    return form.fields
      .filter(
        (f) =>
          !f.hidden &&
          !SYSTEM_COLUMN_TYPES.has(f.columnType ?? "") &&
          (f.pageIndex ?? 0) === pageIndex,
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  function openDeleteDialog(field: FormField) {
    setDeleteDialog({ field, deleteColumn: false });
  }

  function confirmDelete() {
    if (!deleteDialog) return;
    onRemoveField(deleteDialog.field.id, deleteDialog.deleteColumn);
    setDeleteDialog(null);
  }

  function saveThankyou() {
    onThankyouChange(thankyouTitle, thankyouMsg);
    setEditingThankyou(false);
  }

  return (
    <div className="w-full max-w-2xl">
      {/* ── Form header ─────────────────────────────────────── */}
      <div
        className="mb-3 cursor-text rounded-xl bg-white px-6 py-4 shadow-sm dark:bg-[#2b2c30]"
        onClick={() => onSelectField(null)}
      >
        <input
          value={form.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Form title"
          className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
        />
        <input
          value={form.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Add a description…"
          className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/30"
        />
      </div>

      {/* ── Pages ────────────────────────────────────────────── */}
      {pages.map((page, pageIndex) => {
        const pageFields = getPageFields(pageIndex);
        return (
          <div key={page.id} className="mt-3">
            {/* Page label row — shown for all pages */}
            {pageIndex > 0 ? (
              /* Page divider for pages 2+ with title + delete */
              <PageDivider
                page={page}
                canDelete={pages.length > 1}
                onRemove={() => onRemovePage(page.id)}
                onTitleChange={(t) => onUpdatePage(page.id, { title: t })}
              />
            ) : (
              /* Subtle page 1 label */
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                {page.title ?? "Page 1"}
              </p>
            )}

            {/* Field cards — each is its own card on the canvas */}
            <div className="space-y-1.5">
              {/* + at top of page */}
              <AddBetween onClick={() => setAddModal({ pageIndex, allowPage: false })} />

              {/* Fields */}
              {pageFields.length === 0 ? (
                <div className="rounded-xl bg-white px-7 py-8 text-center text-sm text-muted-foreground/60 shadow-sm dark:bg-[#2b2c30]">
                  No questions on this page — click <strong>+</strong> to add
                </div>
              ) : (
                pageFields.map((field) => (
                  <div key={field.id}>
                    <FieldEditorCard
                      field={field}
                      isSelected={selectedFieldId === field.id}
                      boardId={boardId}
                      onSelect={() => onSelectField(field.id)}
                      onUpdate={onUpdateField}
                      onHide={() => onToggleVisible(field.id)}
                      onToggleRequired={() => onToggleRequired(field.id)}
                      onDelete={() => openDeleteDialog(field)}
                    />
                    <AddBetween onClick={() => setAddModal({ pageIndex, allowPage: false })} />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      {/* ── + between pages and Submit ──────────────────────── */}
      <AddBetween
        onClick={() => setAddModal({ pageIndex: pages.length - 1, allowPage: true })}
        alwaysVisible
      />

      {/* ── Submit button ───────────────────────────────────── */}
      <div className="rounded-xl bg-white px-6 py-3 shadow-sm dark:bg-[#2b2c30]">
        <button
          type="button"
          disabled
          className="w-full cursor-default rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {form.submitLabel || "Submit"}
        </button>
      </div>

      {/* ── Thank you page ──────────────────────────────────── */}
      <div
        className={cn(
          "mt-2 rounded-xl shadow-sm transition-colors",
          editingThankyou
            ? "bg-white px-7 py-5 dark:bg-[#2b2c30]"
            : "cursor-pointer bg-white/70 px-5 py-3 hover:bg-white dark:bg-[#2b2c30]/70 dark:hover:bg-[#2b2c30]",
        )}
      >
        {editingThankyou ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">T</div>
              <span className="text-sm font-semibold">Thank you page</span>
            </div>
            <input
              value={thankyouTitle}
              onChange={(e) => setThankyouTitle(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-base font-semibold outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Thank you!"
            />
            <textarea
              value={thankyouMsg}
              onChange={(e) => setThankyouMsg(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="We've received your response."
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingThankyou(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveThankyou}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingThankyou(true)}
            className="flex w-full items-center gap-2"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">T</div>
            <span className="flex-1 text-left text-sm text-muted-foreground">
              {form.thankyouTitle || "Thank you page"}
            </span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          </button>
        )}
      </div>

      {/* ── Add Content Modal ───────────────────────────────── */}
      {addModal && (
        <AddContentModal
          open
          onClose={() => setAddModal(null)}
          boardColumns={board?.columns ?? []}
          formFields={form.fields}
          targetPageIndex={addModal.pageIndex}
          allowPage={addModal.allowPage}
          onAddQuestionType={(type, bct, pi) => { onAddField(type, bct, pi); }}
          onAddBoardColumn={(col, pi) => { onAddBoardColumn(col, pi); }}
          onAddPage={onAddPage}
        />
      )}

      {/* ── Delete confirmation dialog ──────────────────────── */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-1 flex items-start justify-between">
              <h3 className="text-base font-semibold">Delete question?</h3>
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                  <path d="M4.22 4.22a.75.75 0 011.06 0L8 6.94l2.72-2.72a.75.75 0 111.06 1.06L9.06 8l2.72 2.72a.75.75 0 11-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 01-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to delete the question{" "}
              <strong>&ldquo;{deleteDialog.field.name}&rdquo;</strong>?
            </p>
            <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={deleteDialog.deleteColumn}
                onChange={(e) =>
                  setDeleteDialog((d) => d && { ...d, deleteColumn: e.target.checked })
                }
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Delete column on the board
            </label>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleteDialog(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page divider between pages ──────────────────────────────────── */
function PageDivider({
  page,
  canDelete,
  onRemove,
  onTitleChange,
}: {
  page: FormPage;
  canDelete: boolean;
  onRemove: () => void;
  onTitleChange: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title ?? "Page");

  function save() {
    onTitleChange(title || page.title || "Page");
    setEditing(false);
  }

  return (
    <div className="relative mb-2 mt-4 rounded-xl bg-muted/30 px-5 py-3 dark:bg-muted/10">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="flex-1 rounded-md border bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm font-semibold text-foreground hover:text-primary"
          >
            {page.title ?? "Page"}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onRemove}
            title="Delete this page"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Small "+" add button between fields ──────────────────────────── */
function AddBetween({ onClick, alwaysVisible }: { onClick: () => void; alwaysVisible?: boolean }) {
  return (
    <div className="group flex items-center justify-center py-0.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border border-dashed bg-background text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary",
          alwaysVisible
            ? "border-muted-foreground/50 opacity-60 hover:opacity-100"
            : "border-muted-foreground/30 opacity-0 hover:opacity-100 group-hover:opacity-60"
        )}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ── Individual field card ───────────────────────────────────────── */
interface FieldEditorCardProps {
  field: FormField;
  isSelected: boolean;
  boardId: number;
  onSelect: () => void;
  onUpdate: (field: FormField) => void;
  onHide: () => void;
  onToggleRequired: () => void;
  onDelete: () => void;
}

function FieldEditorCard({
  field,
  isSelected,
  boardId,
  onSelect,
  onUpdate,
  onHide,
  onToggleRequired,
  onDelete,
}: FieldEditorCardProps) {
  const { name, setName, save, handleKeyDown, isSaving } = useColumnRename({
    columnId: field.columnId,
    columnName: field.name,
    onRenamed: (newName: string) => onUpdate({ ...field, name: newName }),
  });

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-xl bg-white transition-all shadow-sm dark:bg-[#2b2c30]",
        isSelected ? "ring-2 ring-primary" : "hover:shadow-md",
      )}
    >
      {isSelected && (
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
      )}

      <div className={cn("px-5 pt-3", isSelected ? "pb-0" : "pb-3")}>
        {/* Field header */}
        <div className="flex items-center gap-2.5">
          <TypeIcon type={field.type} />
          {isSelected ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={save}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={isSaving}
              className="flex-1 bg-transparent text-base font-semibold text-foreground outline-none"
              placeholder="Field label"
            />
          ) : (
            <span className="flex-1 text-base font-semibold text-foreground">
              {field.name || getConfig(field.type).label}
            </span>
          )}
          {field.required && !isSelected && (
            <span className="text-sm text-destructive">*</span>
          )}
        </div>

        {/* Expanded section */}
        {isSelected && (
          <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-2.5 pb-3">
            <input
              value={field.description ?? ""}
              onChange={(e) => onUpdate({ ...field, description: e.target.value })}
              placeholder="Add a description…"
              className="w-full bg-transparent text-sm italic text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            />

            <FieldTypeEditor field={field} boardId={boardId} onUpdate={onUpdate} />

            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onToggleRequired}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    field.required
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {field.required && <Check className="h-3 w-3" />}
                  Required
                </button>
              </div>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Type-specific editor content ─────────────────────────────────── */
function FieldTypeEditor({
  field,
  boardId,
  onUpdate,
}: {
  field: FormField;
  boardId: number;
  onUpdate: (field: FormField) => void;
}) {
  const previewInput =
    "w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground/50 pointer-events-none select-none";

  switch (field.type) {
    case "TEXT":
      return <div className={previewInput}>Type your answer…</div>;

    case "LONG_TEXT":
      return <div className={`${previewInput} min-h-[72px]`}>Type your answer…</div>;

    case "NUMBER":
      return <div className={previewInput}>0</div>;

    case "LINK":
      return (
        <div className={`${previewInput} flex items-center gap-2`}>
          <Link2 className="h-3.5 w-3.5 text-muted-foreground/40" />
          https://
        </div>
      );

    case "DATE":
      return (
        <div className={`${previewInput} flex items-center justify-between`}>
          <span>Pick a date</span>
          <Calendar className="h-4 w-4 text-muted-foreground/30" />
        </div>
      );

    case "TIMELINE":
      return (
        <div className="grid grid-cols-2 gap-2">
          {["Start date", "End date"].map((ph) => (
            <div key={ph} className={`${previewInput} flex items-center justify-between`}>
              <span>{ph}</span>
              <Calendar className="h-4 w-4 text-muted-foreground/30" />
            </div>
          ))}
        </div>
      );

    case "CHECKBOX":
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-input bg-background" />
          <span className="text-sm text-muted-foreground/50">Check to confirm</span>
        </div>
      );

    case "STATUS":
      return field.columnId ? (
        <div className="rounded-lg border bg-muted/20 p-2">
          <StatusOptionEditor
            boardId={boardId}
            columnId={field.columnId}
            options={field.options ?? []}
            onChange={(options) => onUpdate({ ...field, options })}
          />
        </div>
      ) : null;

    case "FILE":
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted py-8 text-center">
          <Upload className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/50">Files will be dropped here</p>
        </div>
      );

    default:
      return null;
  }
}
