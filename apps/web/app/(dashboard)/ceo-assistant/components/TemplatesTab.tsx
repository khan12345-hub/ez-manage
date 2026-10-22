"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star, StarOff, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  type EmailTemplate,
} from "@/services/ceo-assistant.api";

const TONES = ["professional", "friendly", "firm"] as const;

interface TemplateFormState {
  name: string;
  subject: string;
  body: string;
  tone: string;
  isDefault: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  subject: "",
  body: "",
  tone: "professional",
  isDefault: false,
};

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  template: EmailTemplate;
  onEdit: (t: EmailTemplate) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{template.name}</span>
            {template.isDefault && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                Default
              </span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
              {template.tone}
            </span>
          </div>
          {template.subject && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              <strong>Subject:</strong> {template.subject}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            title={template.isDefault ? "Already default" : "Set as default"}
            onClick={() => onSetDefault(template.id)}
            disabled={template.isDefault}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {template.isDefault ? (
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(template)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {template.body && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">
          {template.body}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground/60">
        Last updated {new Date(template.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function TemplateFormDialog({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: TemplateFormState & { id?: number };
  onClose: () => void;
  onSave: (form: TemplateFormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<TemplateFormState>(initial);

  // Reset when initial changes (new vs edit)
  const set = (patch: Partial<TemplateFormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs font-semibold">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Weekly Follow-up"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="Email subject line"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Body</Label>
            <Textarea
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Write your email template here..."
              rows={6}
              className="mt-1 resize-y text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Tone</Label>
            <div className="mt-1 flex gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => set({ tone: t })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    form.tone === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => set({ isDefault: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Set as default template</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || !form.body.trim() || saving}
          >
            {saving ? "Saving…" : initial.id ? "Update" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(TemplateFormState & { id?: number }) | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ["ceo-templates"],
    queryFn: getTemplates,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (form: TemplateFormState & { id?: number }) =>
      form.id
        ? updateTemplate(form.id, { name: form.name, subject: form.subject, body: form.body, tone: form.tone, isDefault: form.isDefault })
        : saveTemplate({ name: form.name, subject: form.subject, body: form.body, tone: form.tone, isDefault: form.isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceo-templates"] });
      toast.success(editTarget?.id ? "Template updated." : "Template saved.");
      setDialogOpen(false);
      setEditTarget(null);
    },
    onError: () => toast.error("Failed to save template."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceo-templates"] });
      toast.success("Template deleted.");
    },
    onError: () => toast.error("Failed to delete template."),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: number) => updateTemplate(id, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceo-templates"] });
      toast.success("Default template updated.");
    },
  });

  function openCreate() {
    setEditTarget({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(t: EmailTemplate) {
    setEditTarget({ id: t.id, name: t.name, subject: t.subject, body: t.body, tone: t.tone, isDefault: t.isDefault });
    setDialogOpen(true);
  }

  function handleDelete(id: number) {
    const t = templates.find((x) => x.id === id);
    if (confirm(`Delete template "${t?.name ?? id}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">Failed to load templates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length === 0
            ? "No templates yet"
            : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No templates saved</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create a template to quickly pre-fill email subjects and bodies when generating drafts.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={(id) => defaultMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      {editTarget !== null && (
        <TemplateFormDialog
          open={dialogOpen}
          initial={editTarget}
          onClose={() => { setDialogOpen(false); setEditTarget(null); }}
          onSave={(form) => saveMutation.mutate({ ...form, id: editTarget.id })}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}
