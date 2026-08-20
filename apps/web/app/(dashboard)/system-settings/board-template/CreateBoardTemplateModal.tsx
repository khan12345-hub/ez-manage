"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  useCreateBoardTemplateMutation,
  useUpdateBoardTemplateMutation,
} from "./useBoardTemplateMutations";

import { TemplateBasicInfo } from "./TemplateBasicInfo";
import { TemplateGroups } from "./TemplateGroups";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

import {
  BoardTemplate,
  TemplateColumn,
  TemplateGroup,
} from "./template.types";

import {
  addTemplateColumn,
  addTemplateGroup,
  buildCreateTemplatePayload,
  createInitialGroups,
  mapBoardTemplateToGroups,
  removeTemplateColumn,
  removeTemplateGroup,
  updateTemplateColumn,
  updateTemplateGroup,
} from "./template.helpers";

interface CreateBoardTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: BoardTemplate | null;
}

interface TemplateFormState {
  name: string;
  description: string;
  groups: TemplateGroup[];
}

export function CreateBoardTemplateDialog({
  open,
  onOpenChange,
  template,
}: CreateBoardTemplateDialogProps) {
  const createMutation = useCreateBoardTemplateMutation();
  const updateMutation = useUpdateBoardTemplateMutation();

  const isEditing = Boolean(template);
  const isPending =
    createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groups, setGroups] =
    useState<TemplateGroup[]>(createInitialGroups);

  const [initialState, setInitialState] =
    useState<TemplateFormState | null>(null);

  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [shouldReopen, setShouldReopen] = useState(false);

  /**
   * Compare the current form state with the state
   * that existed when the modal was opened.
   */
  const hasUnsavedChanges =
    initialState !== null &&
    JSON.stringify({
      name,
      description,
      groups,
    }) !== JSON.stringify(initialState);

  /**
   * Initialize the form whenever the modal opens
   * or the template being edited changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    if (!template) {
      const initialGroups = createInitialGroups();

      setName("");
      setDescription("");
      setGroups(initialGroups);

      setInitialState({
        name: "",
        description: "",
        groups: initialGroups,
      });

      return;
    }

    const mappedGroups = mapBoardTemplateToGroups(template);

    setName(template.name);
    setDescription(template.description ?? "");
    setGroups(mappedGroups);

    setInitialState({
      name: template.name,
      description: template.description ?? "",
      groups: mappedGroups,
    });
  }, [open, template]);

  function reset() {
    setName("");
    setDescription("");
    setGroups(createInitialGroups());
    setInitialState(null);
  }

  /**
   * Handles closing the main modal.
   *
   * If there are unsaved changes:
   * 1. Close the main modal.
   * 2. Open the confirmation modal.
   *
   * This prevents two Radix Dialogs from being open
   * at the same time and avoids the visual jerk.
   */
  function handleOpenChange(value: boolean) {
    if (value) {
      onOpenChange(true);
      return;
    }

    if (isPending) {
      return;
    }

    if (!hasUnsavedChanges) {
      reset();
      onOpenChange(false);
      return;
    }

    // Close the main dialog first.
    onOpenChange(false);

    // Then show the confirmation dialog.
    setDiscardDialogOpen(true);
  }

  /**
   * User chose "Continue Editing".
   *
   * We close the confirmation first and remember
   * that the main dialog should be reopened after
   * the confirmation has completely closed.
   */
  function handleContinueEditing() {
    setShouldReopen(true);
    setDiscardDialogOpen(false);
  }

  /**
   * User chose "Discard Changes".
   */
  function handleDiscardChanges() {
    setShouldReopen(false);
    setDiscardDialogOpen(false);

    reset();
    onOpenChange(false);
  }

  /**
   * Called after the confirmation dialog has actually
   * finished closing.
   */
  function handleDiscardDialogClosed() {
    if (!shouldReopen) {
      return;
    }

    setShouldReopen(false);

    // Let Radix finish its focus/overlay cleanup
    // before reopening the main dialog.
    requestAnimationFrame(() => {
      onOpenChange(true);
    });
  }

  function handleAddGroup() {
    setGroups((current) => addTemplateGroup(current));
  }

  function handleDeleteGroup(groupId: string) {
    setGroups((current) =>
      removeTemplateGroup(current, groupId),
    );
  }

  function handleAddColumn(groupId: string) {
    setGroups((current) =>
      addTemplateColumn(current, groupId),
    );
  }

  function handleDeleteColumn(
    groupId: string,
    columnId: string,
  ) {
    setGroups((current) =>
      removeTemplateColumn(current, groupId, columnId),
    );
  }

  function handleColumnChange(
    groupId: string,
    columnId: string,
    changes: Partial<TemplateColumn>,
  ) {
    setGroups((current) =>
      updateTemplateColumn(
        current,
        groupId,
        columnId,
        changes,
      ),
    );
  }

  function handleGroupChange(
    groupId: string,
    changes: Partial<TemplateGroup>,
  ) {
    setGroups((current) =>
      updateTemplateGroup(
        current,
        groupId,
        changes,
      ),
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    const payload = buildCreateTemplatePayload({
      name,
      description,
      groups,
    });

    if (template) {
      await updateMutation.mutateAsync({
        templateId: template.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }

    reset();
    setDiscardDialogOpen(false);
    setShouldReopen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="max-h-[90vh] max-w-5/10! overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? "Edit board template"
                : "Create board template"}
            </DialogTitle>

            <DialogDescription>
              {isEditing
                ? "Update this reusable board structure."
                : "Create a reusable board structure."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-2">
              <TemplateBasicInfo
                name={name}
                description={description}
                onNameChange={setName}
                onDescriptionChange={setDescription}
              />

              <TemplateGroups
                groups={groups}
                onAddGroup={handleAddGroup}
                onDeleteGroup={handleDeleteGroup}
                onGroupChange={handleGroupChange}
                onAddColumn={handleAddColumn}
                onDeleteColumn={handleDeleteColumn}
                onColumnChange={handleColumnChange}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={!name.trim() || isPending}
              >
                {isPending
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                    ? "Save template"
                    : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      
    </>
  );
}