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
  renameTemplateGroup,
  updateTemplateColumn,
  updateTemplateGroup,
} from "./template.helpers";

interface CreateBoardTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  template?: BoardTemplate | null;
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
    createMutation.isPending ||
    updateMutation.isPending;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [groups, setGroups] = useState<TemplateGroup[]>(createInitialGroups);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!template) {
      reset();

      return;
    }

    setName(template.name);
    setDescription(template.description ?? "");
    setGroups(mapBoardTemplateToGroups(template));
  }, [open, template]);

  function reset() {
    setName("");
    setDescription("");
    setGroups(createInitialGroups());
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      reset();
    }

    onOpenChange(value);
  }

  function handleAddGroup() {
    setGroups((current) => addTemplateGroup(current));
  }

  function handleDeleteGroup(groupId: string) {
    setGroups((current) => removeTemplateGroup(current, groupId));
  }

  function handleGroupNameChange(groupId: string, name: string) {
    setGroups((current) => renameTemplateGroup(current, groupId, name));
  }

  function handleAddColumn(groupId: string) {
    setGroups((current) => addTemplateColumn(current, groupId));
  }

  function handleDeleteColumn(groupId: string, columnId: string) {
    setGroups((current) => removeTemplateColumn(current, groupId, columnId));
  }

  function handleColumnChange(
    groupId: string,
    columnId: string,
    changes: Partial<TemplateColumn>,
  ) {
    setGroups((current) =>
      updateTemplateColumn(current, groupId, columnId, changes),
    );
  }

  function handleGroupChange(groupId: string, changes: Partial<TemplateGroup>) {
    setGroups((current) => updateTemplateGroup(current, groupId, changes));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
  );
}
