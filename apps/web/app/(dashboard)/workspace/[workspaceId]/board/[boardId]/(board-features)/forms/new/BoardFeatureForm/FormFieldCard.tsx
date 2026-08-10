"use client";

import { Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FormField, FormFieldOption } from "./board-feature-form.types";

import { DatePicker } from "./DatePicker";
import { TimelinePicker } from "./TimelinePicker";
import { StatusOptionEditor } from "./StatusOptionEditor";

import { useColumnRename } from "../../../../../group/columns/useColumnRename.hooks";

interface FormFieldCardProps {
  field: FormField;
  onChange: (field: FormField) => void;
  onDelete: () => void;
}

export function FormFieldCard({
  field,
  onChange,
  onDelete,
}: FormFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: field.id,
    });

  const { name, setName, save, handleKeyDown, isSaving } = useColumnRename({
    columnId: field.columnId,
    columnName: field.name,
    onRenamed: (newName) => {
      onChange({
        ...field,
        name: newName,
      });
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function updateOption(optionId: string, updates: Partial<FormFieldOption>) {
    onChange({
      ...field,
      options: (field.options ?? []).map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...updates,
            }
          : option,
      ),
    });
  }

  function addOption() {
    const optionNumber = (field.options?.length ?? 0) + 1;

    const newOption: FormFieldOption = {
      id: crypto.randomUUID(),
      label: `Option ${optionNumber}`,
      value: `option-${optionNumber}`,
      color: "#0086c9",
      isNew: true,
    };

    onChange({
      ...field,
      options: [...(field.options ?? []), newOption],
    });
  }

  function deleteOption(optionId: string) {
    if ((field.options?.length ?? 0) <= 1) {
      return;
    }

    onChange({
      ...field,
      options: (field.options ?? []).filter((option) => option.id !== optionId),
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border p-4"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="
          mt-2
          cursor-grab
          text-muted-foreground
          hover:text-foreground
          active:cursor-grabbing
        "
        aria-label="Drag field"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 space-y-4">
        {/* Column name + Field label + Type */}
        <div className="flex gap-3">
          {field.columnId && (
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              onBlur={save}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              placeholder="Column name"
              className="
      h-9
      border-transparent
      bg-muted/40
      font-medium
      shadow-none
      focus-visible:ring-1
    "
            />
          )}

         

          {/* <Select
            value={field.type}
            disabled={Boolean(field.columnId)}
            onValueChange={(value) =>
              onChange({
                ...field,
                type: value as FormField["type"],
              })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Field type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Short Text</SelectItem>
              <SelectItem value="TEXTAREA">Long Text</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
              <SelectItem value="NUMBER">Number</SelectItem>
              <SelectItem value="DATE">Date</SelectItem>
              <SelectItem value="TIMELINE">Timeline</SelectItem>
              <SelectItem value="SELECT">Dropdown</SelectItem>
              <SelectItem value="CHECKBOX">Checkbox</SelectItem>
            </SelectContent>
          </Select> */}
        </div>

        
        {/* Date */}
        {field.type === "DATE" && (
          <DatePicker
            value={field.date}
            onChange={(date) =>
              onChange({
                ...field,
                date,
              })
            }
          />
        )}

        {/* Timeline */}
        {field.type === "TIMELINE" && (
          <TimelinePicker
            value={field.timeline}
            onChange={(range) =>
              onChange({
                ...field,
                timeline: range,
              })
            }
          />
        )}

        {/* Required */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(checked) =>
              onChange({
                ...field,
                required: checked === true,
              })
            }
          />

          <label
            htmlFor={`required-${field.id}`}
            className="cursor-pointer text-sm font-medium"
          >
            Required
          </label>
        </div>

        {/* STATUS options */}
        {field.type === "STATUS" && field.columnId && (
          <StatusOptionEditor
            columnId={field.columnId}
            options={field.options ?? []}
            onChange={(options) =>
              onChange({
                ...field,
                options,
              })
            }
          />
        )}
      </div>

      {/* Delete field */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="
          mt-1
          shrink-0
          text-muted-foreground
          hover:text-destructive
        "
        aria-label="Delete field"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
