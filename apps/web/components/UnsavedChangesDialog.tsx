"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onContinue: () => void;
  onClosed?: () => void;
  title?: string;
  description?: string;
  discardLabel?: string;
  continueLabel?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onContinue,
  onClosed,
  title = "Discard unsaved changes?",
  description = "You have unsaved changes. If you close this window, your changes will be lost.",
  discardLabel = "Discard changes",
  continueLabel = "Continue editing",
}: UnsavedChangesDialogProps) {
  function handleOpenChange(value: boolean) {
    onOpenChange(value);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();

          if (!open) {
            onClosed?.();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onContinue}
          >
            {continueLabel}
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onDiscard}
          >
            {discardLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}