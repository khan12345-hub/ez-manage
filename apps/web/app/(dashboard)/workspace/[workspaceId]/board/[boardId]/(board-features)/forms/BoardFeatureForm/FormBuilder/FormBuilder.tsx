"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Pencil, ChevronDown, ChevronRight } from "lucide-react";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BoardColumnType, deleteColumn } from "@/services/columns.api";
import { getBoardForm, uploadPublicFormFile } from "@/services/board-form.api";

import { FormField, FormFieldType, FormPage } from "./board-feature-form.types";
import { getDefaultLabel, SYSTEM_COLUMN_TYPES, mapColumnTypeToFormType } from "./board-form.utils";
import { useFormBuilder } from "./hooks/useFormBuilder";
import { useFormBuilderMutations } from "./hooks/useFormMutations";

import { FormFieldRow } from "./FormFieldRow";
import { FormEditorPanel } from "./FormEditorPanel";
import { FormPreview, FormDesign, DEFAULT_DESIGN } from "./FormPreview";
import { FormDesignPanel } from "./FormDesignPanel";
import { AddContentModal } from "./AddContentModal";
import { CopyFormLinkButton } from "../../CopyFormLinkButton";

type FormMode = "edit" | "preview" | "design";

interface FormBuilderProps {
  board: any;
}

export function FormBuilder({ board }: FormBuilderProps) {
  const boardId = board?.id;

  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [design, setDesign] = useState<FormDesign>(DEFAULT_DESIGN);
  const [sidebarModalOpen, setSidebarModalOpen] = useState(false);

  const { data: existingForm, isLoading } = useQuery({
    queryKey: ["board-form", boardId],
    queryFn: () => getBoardForm(boardId),
    enabled: Boolean(boardId),
    retry: false,
  });

  // Load saved design when existingForm arrives
  useEffect(() => {
    if (existingForm?.design) {
      setDesign({ ...DEFAULT_DESIGN, ...(existingForm.design as Partial<FormDesign>) });
    }
  }, [existingForm?.id]);

  const {
    form,
    setName,
    setDescription,
    setGroupId,
    setSubmitLabel,
    setThankyou,
    addField,
    updateField,
    removeField,
    toggleFieldHidden,
    toggleFieldRequired,
    reorderFields,
    setColumnId,
    addPage,
    removePage,
    updatePage,
  } = useFormBuilder(board, existingForm);

  const { createColumnMutation, saveMutation } = useFormBuilderMutations(boardId, existingForm);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sidebarFields = form.fields.filter(
    (f) => !SYSTEM_COLUMN_TYPES.has(f.columnType ?? ""),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sidebarFields.findIndex((f) => f.id === active.id);
    const newIdx = sidebarFields.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderFields(arrayMove(sidebarFields, oldIdx, newIdx).map((f, i) => ({ ...f, position: i })));
  }

  /** Add a new question field (creates a new board column) */
  function handleAddField(type: FormFieldType, boardColumnType: string, pageIndex: number) {
    const field: FormField = {
      id: crypto.randomUUID(),
      name: getDefaultLabel(type),
      type,
      required: false,
      placeholder: "",
      columnId: undefined,
      position: form.fields.length,
      hidden: false,
      pageIndex,
    };
    addField(field);
    createColumnMutation.mutate(boardColumnType as unknown as BoardColumnType, {
      onSuccess: (column) => {
        setColumnId(field.id, column.id, column.name);
        setSelectedFieldId(field.id);
      },
      onError: () => {
        removeField(field.id);
        toast.error("Failed to create column");
      },
    });
  }

  /** Add an existing board column as a form field (no new column needed) */
  function handleAddBoardColumn(column: any, pageIndex: number) {
    const existing = form.fields.find((f) => f.columnId === column.id);
    if (existing) {
      // Just unhide it
      if (existing.hidden) toggleFieldHidden(existing.id);
      return;
    }
    const field: FormField = {
      id: crypto.randomUUID(),
      name: column.name,
      type: mapColumnTypeToFormType(column.type),
      columnType: column.type,
      required: false,
      placeholder: "",
      columnId: column.id,
      position: form.fields.length,
      hidden: false,
      pageIndex,
      options:
        ["STATUS", "DROPDOWN", "LABEL"].includes(column.type)
          ? (column.statusOptions ?? []).map((o: any) => ({
              id: String(o.id),
              label: o.label,
              color: o.color ?? "#6366f1",
              isNew: false,
            }))
          : undefined,
    };
    addField(field);
  }

  /** Remove a field from the form, optionally deleting its board column */
  function handleRemoveField(fieldId: string, shouldDeleteColumn: boolean) {
    const field = form.fields.find((f) => f.id === fieldId);
    toggleFieldHidden(fieldId); // hide from form
    if (shouldDeleteColumn && field?.columnId) {
      deleteColumn(field.columnId).catch(() => {
        toast.error("Failed to delete column from board");
      });
    }
  }

  function handleSave() {
    if (!form.groupId) {
      toast.error("Please select a submission group");
      return;
    }
    if (form.fields.some((f) => !f.columnId)) {
      toast.error("Please wait for new columns to finish creating");
      return;
    }
    saveMutation.mutate({ form, design });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS: { id: FormMode; label: string }[] = [
    { id: "edit",    label: "Edit" },
    { id: "design",  label: "Design" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  mode === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CopyFormLinkButton boardId={boardId} formId={existingForm?.id} shareToken={existingForm?.shareToken} />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || createColumnMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {existingForm ? "Save" : "Create form"}
          </Button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Preview mode ── */}
        {mode === "preview" && (
          <div className="relative flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-6 py-2.5 backdrop-blur dark:bg-[#1e1f22]/90">
              <span className="text-sm font-medium text-muted-foreground">
                Preview — this is how your form looks to users
              </span>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit form
              </button>
            </div>
            <FormPreview form={form} design={design} fill />
          </div>
        )}

        {/* ── Edit mode ── */}
        {mode === "edit" && (
          <>
            <EditSidebar
              form={form}
              board={board}
              sidebarFields={sidebarFields}
              sensors={sensors}
              selectedFieldId={selectedFieldId}
              onSelectField={setSelectedFieldId}
              onToggleHidden={toggleFieldHidden}
              onToggleRequired={toggleFieldRequired}
              onDragEnd={handleDragEnd}
              onGroupChange={setGroupId}
              onOpenAddContent={() => setSidebarModalOpen(true)}
            />

            <main
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: design.bgColor }}
              onClick={() => setSelectedFieldId(null)}
            >
              <div className="flex min-h-full items-start justify-center px-8 py-8">
                <FormEditorPanel
                  form={form}
                  selectedFieldId={selectedFieldId}
                  boardId={boardId}
                  board={board}
                  onSelectField={setSelectedFieldId}
                  onUpdateField={updateField}
                  onToggleVisible={toggleFieldHidden}
                  onToggleRequired={toggleFieldRequired}
                  onAddField={handleAddField}
                  onAddBoardColumn={handleAddBoardColumn}
                  onRemoveField={handleRemoveField}
                  onNameChange={setName}
                  onDescriptionChange={setDescription}
                  onAddPage={addPage}
                  onRemovePage={removePage}
                  onUpdatePage={updatePage}
                  onThankyouChange={setThankyou}
                />
              </div>
            </main>
          </>
        )}

        {/* ── Design mode ── */}
        {mode === "design" && (
          <>
            <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
              <FormDesignPanel
                design={design}
                onChange={setDesign}
                onLogoUpload={async (file) => {
                  const result = await uploadPublicFormFile(boardId, file);
                  return result.url;
                }}
              />
            </aside>
            <main className="flex-1 overflow-y-auto" style={{ backgroundColor: design.bgColor }}>
              <FormPreview form={form} design={design} fill />
            </main>
          </>
        )}
      </div>

      {/* ── Sidebar "Add content" modal (allows page block) ── */}
      {sidebarModalOpen && (
        <AddContentModal
          open
          onClose={() => setSidebarModalOpen(false)}
          boardColumns={board?.columns ?? []}
          formFields={form.fields}
          targetPageIndex={(form.pages.length ?? 1) - 1}
          allowPage
          onAddQuestionType={handleAddField}
          onAddBoardColumn={handleAddBoardColumn}
          onAddPage={() => { addPage(); setSidebarModalOpen(false); }}
        />
      )}
    </div>
  );
}

/* ── Edit sidebar ──────────────────────────────────────────────────── */
function EditSidebar({
  form,
  board,
  sidebarFields,
  sensors,
  selectedFieldId,
  onSelectField,
  onToggleHidden,
  onToggleRequired,
  onDragEnd,
  onGroupChange,
  onOpenAddContent,
}: {
  form: any;
  board: any;
  sidebarFields: any[];
  sensors: any;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleRequired: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onGroupChange: (groupId: number | null) => void;
  onOpenAddContent: () => void;
}) {
  const pages = form.pages?.length > 0
    ? form.pages
    : [{ id: "default", title: "Page 1" }];

  const [collapsedPages, setCollapsedPages] = useState<Set<number>>(new Set());

  function togglePage(pageIndex: number) {
    setCollapsedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) next.delete(pageIndex);
      else next.add(pageIndex);
      return next;
    });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Content</span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-2">
        {/* Welcome page (placeholder) */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground/50">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold">W</div>
          <span>Welcome page</span>
        </div>

        {/* Submission group */}
        <div className="mx-3 mb-2 rounded-md border bg-muted/30 p-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Submission group
          </label>
          <select
            value={form.groupId ? String(form.groupId) : ""}
            onChange={(e) => onGroupChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded border bg-background px-1.5 py-1 text-xs focus:outline-none"
          >
            <option value="">Select group…</option>
            {(board?.groups ?? []).map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Pages with fields */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={sidebarFields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {pages.map((page: FormPage, pageIndex: number) => {
              const isCollapsed = collapsedPages.has(pageIndex);
              const pageFields = sidebarFields.filter(
                (f) => (f.pageIndex ?? 0) === pageIndex,
              );

              return (
                <div key={page.id} className="mt-1 px-2">
                  {/* Page header */}
                  <button
                    type="button"
                    onClick={() => togglePage(pageIndex)}
                    className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />
                    }
                    <span>{page.title ?? `Page ${pageIndex + 1}`}</span>
                  </button>

                  {/* Fields under this page */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 pl-2">
                      {pageFields.length === 0 ? (
                        <p className="px-2 py-1 text-[11px] italic text-muted-foreground/50">
                          Empty page
                        </p>
                      ) : (
                        pageFields.map((field) => (
                          <FormFieldRow
                            key={field.id}
                            field={field}
                            isSelected={selectedFieldId === field.id}
                            isExpanded={false}
                            onSelect={() => onSelectField(field.id)}
                            onToggleExpand={() => {}}
                            onToggleVisible={() => onToggleHidden(field.id)}
                            onToggleRequired={() => onToggleRequired(field.id)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Thank you page */}
        <div className="mt-auto border-t px-3 py-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-bold text-background">T</div>
            <span>Thank you page</span>
          </div>
        </div>

        {/* Add content button */}
        <div className="border-t px-3 py-2">
          <button
            type="button"
            onClick={onOpenAddContent}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-muted-foreground/30 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <span className="text-base leading-none">+</span>
            Add content
          </button>
        </div>
      </div>
    </aside>
  );
}
