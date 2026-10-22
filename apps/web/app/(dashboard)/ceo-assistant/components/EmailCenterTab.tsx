"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Send, RefreshCcw, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCeoAssistantStore } from "@/store/ceo-assistant-store";
import { generateEmailDrafts, sendEmails } from "@/services/ceo-assistant.api";
import { EmailDraftCard } from "./EmailDraftCard";
import { BulkSendConfirmModal } from "./BulkSendConfirmModal";
import { TemplateSelector } from "./TemplateSelector";
import { EmployeeList } from "./EmployeeList";
import type { EmailTemplate } from "@/services/ceo-assistant.api";

export function EmailCenterTab({ onSent }: { onSent?: () => void }) {
  const {
    selectedEmployeeIds,
    employees,
    filters,
    drafts,
    setDrafts,
    clearDrafts,
    selectedDraftIds,
    selectAllDrafts,
    clearDraftSelection,
    toggleDraftSelection,
    generatingIds,
    setGenerating,
    clearGenerating,
  } = useCeoAssistantStore();

  const [generating, setGeneratingState] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(true);
  // Template preview (for TemplateSelector "save current" feature)
  const firstDraft = [...useCeoAssistantStore.getState().drafts.values()][0];
  const [sending, setSending] = useState(false);

  const selectedEmployees = employees.filter((e) => selectedEmployeeIds.has(e.user.id));
  const draftList = [...drafts.values()];
  const selectedDrafts = draftList.filter((d) => selectedDraftIds.has(d.recipientId));

  async function handleGenerate() {
    if (selectedEmployeeIds.size === 0) {
      toast.error("Select at least one recipient first.");
      return;
    }

    setGeneratingState(true);
    setGenerating([...selectedEmployeeIds]);
    try {
      const result = await generateEmailDrafts({
        employeeIds: [...selectedEmployeeIds],
        categories: filters.categories,
        tone: filters.tone,
        inactivityDays: filters.inactivityDays,
        upcomingDays: filters.upcomingDays,
      });
      setDrafts(result.drafts);
      toast.success(`${result.drafts.length} draft${result.drafts.length !== 1 ? "s" : ""} generated.`);
    } catch {
      toast.error("Failed to generate email drafts. Please try again.");
    } finally {
      setGeneratingState(false);
      clearGenerating();
    }
  }

  async function handleSend() {
    if (selectedDrafts.length === 0) return;
    setSending(true);
    try {
      const { queued } = await sendEmails(
        selectedDrafts.map((d) => ({
          recipientId: d.recipientId,
          subject: d.subject,
          body: d.body,
        })),
      );

      toast.success(`${queued} email${queued !== 1 ? "s" : ""} queued — check Email History in a moment.`);
      clearDrafts();
      clearDraftSelection();
      setConfirmOpen(false);
      onSent?.();
    } catch {
      toast.error("Failed to queue emails. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Step 1 — Recipient selection */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setRecipientsOpen((p) => !p)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-semibold text-foreground">
              Step 1 — Select Recipients
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {selectedEmployeeIds.size === 0
                ? "No one selected"
                : `${selectedEmployeeIds.size} member${selectedEmployeeIds.size !== 1 ? "s" : ""} selected`}
            </span>
          </div>
          {recipientsOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {recipientsOpen && (
          <div className="border-t border-border p-4">
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No team members found. Make sure tasks are assigned.
              </p>
            ) : (
              <EmployeeList employees={employees} activeFilter={null} />
            )}
          </div>
        )}
      </div>

      {/* Step 2 — Config bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">Step 2 — Configure &amp; Generate</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tone:</span>
          {(["professional", "friendly", "firm"] as const).map((t) => (
            <button
              key={t}
              onClick={() => useCeoAssistantStore.getState().setFilters({ tone: t })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                filters.tone === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <TemplateSelector
          currentSubject={firstDraft?.subject}
          currentBody={firstDraft?.body}
          currentTone={filters.tone}
          onLoad={(t: EmailTemplate) => {
            useCeoAssistantStore.getState().setFilters({ tone: t.tone as any });
          }}
        />

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || selectedEmployeeIds.size === 0}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? "Generating…" : "Generate Drafts"}
        </Button>
      </div>

      {/* Drafts */}
      {draftList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No drafts yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Select recipients above, then click "Generate Drafts"
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() =>
                selectedDraftIds.size === draftList.length ? clearDraftSelection() : selectAllDrafts()
              }
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedDraftIds.size === draftList.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedDraftIds.size}/{draftList.length} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={clearDrafts} className="gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={selectedDrafts.length === 0}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send {selectedDrafts.length > 0 ? `(${selectedDrafts.length})` : ""}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {draftList.map((draft) => (
              <EmailDraftCard
                key={draft.recipientId}
                draft={draft}
                employee={selectedEmployees.find((e) => e.user.id === draft.recipientId)}
              />
            ))}
          </div>
        </>
      )}

      <BulkSendConfirmModal
        open={confirmOpen}
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
        draftsToSend={selectedDrafts}
        employees={employees}
        sending={sending}
      />
    </div>
  );
}
