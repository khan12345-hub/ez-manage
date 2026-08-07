"use client";

import { GripVertical, Trash2 } from "lucide-react";

import { useSortable } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { FormField, FormFieldOption } from "./board-feature-form.types";

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-background p-4"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 cursor-grab text-muted-foreground"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1 space-y-4">
          <div className="flex gap-3">
            <input
              value={field.label}
              onChange={(event) =>
                onChange({
                  ...field,
                  label: event.target.value,
                })
              }
              className="flex-1 rounded-md border px-3 py-2"
              placeholder="Field label"
            />

            <select
              value={field.type}
              onChange={(event) =>
                onChange({
                  ...field,
                  type: event.target.value as FormField["type"],
                })
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="TEXT">Short Text</option>

              <option value="TEXTAREA">Long Text</option>

              <option value="EMAIL">Email</option>

              <option value="NUMBER">Number</option>

              <option value="DATE">Date</option>

              <option value="SELECT">Dropdown</option>

              <option value="CHECKBOX">Checkbox</option>
            </select>
          </div>

          {field.type !== "CHECKBOX" && (
            <input
              value={field.placeholder ?? ""}
              onChange={(event) =>
                onChange({
                  ...field,
                  placeholder: event.target.value,
                })
              }
              placeholder="Placeholder (optional)"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(event) =>
                onChange({
                  ...field,
                  required: event.target.checked,
                })
              }
            />
            Required
          </label>

          {field.type === "SELECT" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Options</p>

              {field.options?.map((option) => (
                <input
                  key={option.id}
                  value={option.label}
                  onChange={(event) => {
                    const label = event.target.value;

                    const options: FormFieldOption[] = field.options!.map(
                      (currentOption) =>
                        currentOption.id === option.id
                          ? {
                              id: currentOption.id,
                              label,
                              value: label.toLowerCase().replace(/\s+/g, "-"),
                            }
                          : currentOption,
                    );

                    onChange({
                      ...field,
                      options,
                    });
                  }}
                  className="w-full rounded-md border px-3 py-2"
                />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
