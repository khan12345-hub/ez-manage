"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmailDraft, EmployeeTaskGroup } from "@/services/ceo-assistant.api";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  draftsToSend: EmailDraft[];
  employees: EmployeeTaskGroup[];
  sending: boolean;
}

export function BulkSendConfirmModal({
  open,
  onConfirm,
  onCancel,
  draftsToSend,
  employees,
  sending,
}: Props) {
  const employeeMap = new Map(employees.map((e) => [e.user.id, e]));

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Send {draftsToSend.length} email{draftsToSend.length !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-3">
                The following employees will receive a task reminder email:
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {draftsToSend.map((d) => {
                  const emp = employeeMap.get(d.recipientId);
                  return (
                    <li key={d.recipientId} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {emp ? `${emp.user.firstName} ${emp.user.lastName}` : `#${d.recipientId}`}
                      </span>
                      {emp && (
                        <span className="text-muted-foreground text-xs">— {emp.user.email}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Each employee will also receive an in-app notification.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={sending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={sending}>
            {sending ? "Sending…" : `Send ${draftsToSend.length} email${draftsToSend.length !== 1 ? "s" : ""}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
