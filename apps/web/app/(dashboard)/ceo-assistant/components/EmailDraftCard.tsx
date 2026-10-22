"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { EmailDraft, EmployeeTaskGroup } from "@/services/ceo-assistant.api";
import { useCeoAssistantStore } from "@/store/ceo-assistant-store";

interface Props {
  draft: EmailDraft;
  employee: EmployeeTaskGroup | undefined;
}

export function EmailDraftCard({ draft, employee }: Props) {
  const { selectedDraftIds, toggleDraftSelection, updateDraft } = useCeoAssistantStore();
  const isSelected = selectedDraftIds.has(draft.recipientId);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editBody, setEditBody] = useState(draft.body);

  const handleSubjectChange = (v: string) => {
    setEditSubject(v);
    updateDraft(draft.recipientId, { subject: v });
  };

  const handleBodyChange = (v: string) => {
    setEditBody(v);
    updateDraft(draft.recipientId, { body: v });
  };

  const name = employee
    ? `${employee.user.firstName} ${employee.user.lastName}`
    : `User #${draft.recipientId}`;

  const initials = employee
    ? `${employee.user.firstName[0] ?? ""}${employee.user.lastName[0] ?? ""}`.toUpperCase()
    : "?";

  const overdueCount = draft.taskSnapshot.overdue.length;
  const dueSoonCount = draft.taskSnapshot.dueSoon.length;
  const inactiveCount = draft.taskSnapshot.inactive.length;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all",
        isSelected && "border-primary ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleDraftSelection(draft.recipientId)}
          className="shrink-0"
        />
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={employee?.user.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">{name}</span>
          {employee && (
            <span className="ml-2 text-xs text-muted-foreground">{employee.user.email}</span>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
              {overdueCount} overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              {dueSoonCount} due soon
            </span>
          )}
          {inactiveCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {inactiveCount} inactive
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Subject
          </label>
          <Input
            value={editSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Body
          </label>
          <Textarea
            value={editBody}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={5}
            className="text-sm resize-y"
          />
        </div>
      </div>
    </div>
  );
}
