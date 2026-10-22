"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Save, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  deleteTemplate,
  type EmailTemplate,
} from "@/services/ceo-assistant.api";
import { useCeoAssistantStore } from "@/store/ceo-assistant-store";

interface Props {
  /** Called when user loads a template — parent should pre-fill subject/body/tone */
  onLoad: (template: EmailTemplate) => void;
  /** Current subject + body to save as new template */
  currentSubject?: string;
  currentBody?: string;
  currentTone?: string;
}

export function TemplateSelector({ onLoad, currentSubject = "", currentBody = "", currentTone = "professional" }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["ceo-templates"],
    queryFn: getTemplates,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTemplate({
        name: newName.trim(),
        subject: currentSubject,
        body: currentBody,
        tone: currentTone,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceo-templates"] });
      toast.success("Template saved.");
      setSaveOpen(false);
      setNewName("");
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

  function handleLoad(t: EmailTemplate) {
    onLoad(t);
    setLoadedId(t.id);
    setOpen(false);
    toast.success(`Template "${t.name}" loaded.`);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Load template */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Load Template
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="border-b px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Saved Templates
              </p>
            </div>
            {isLoading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No templates saved yet.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto divide-y">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => handleLoad(t)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        {t.isDefault && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            default
                          </span>
                        )}
                        {loadedId === t.id && (
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.subject || "No subject"}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete template "${t.name}"?`)) {
                          deleteMutation.mutate(t.id);
                        }
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>

        {/* Save current as template */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setSaveOpen(true)}
          disabled={!currentBody.trim()}
        >
          <Save className="h-3.5 w-3.5" />
          Save as Template
        </Button>
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Template name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Weekly Follow-up"
                className="mt-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) saveMutation.mutate();
                }}
              />
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <strong>Subject:</strong> {currentSubject || "(empty)"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!newName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
