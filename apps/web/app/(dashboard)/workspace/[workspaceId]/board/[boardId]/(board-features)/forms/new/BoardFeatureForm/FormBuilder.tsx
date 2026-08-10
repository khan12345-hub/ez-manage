"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { FormBuilderState, FormField } from "./board-feature-form.types";

import { AddFieldMenu } from "./AddFieldMenu";
import { FormFieldCard } from "./FormFieldCard";
import { useMutation } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";

interface FormBuilderProps {
  board: any;
}

export function FormBuilder({ board }: FormBuilderProps) {
  const [form, setForm] = useState<FormBuilderState>(() => ({
    name: "",
    description: "",
    groupId: null,

    // Automatically add all existing board columns
    fields: mapBoardColumnsToFields(board?.columns ?? []),
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const createColumnMutation = useMutation({
    mutationFn: ({ type }: { type: BoardColumnType; fieldId: string }) =>
      createColumn(board.id || 0, type),

    onSuccess: (createdColumn, variables) => {
      setForm((current) => ({
        ...current,
        fields: current.fields.map((field) => {
          if (field.id !== variables.fieldId) {
            return field;
          }

          return {
            ...field,
            columnId: createdColumn.id,
          };
        }),
      }));
    },

    onError: (_, variables) => {
      setForm((current) => ({
        ...current,
        fields: current.fields.filter(
          (field) => field.id !== variables.fieldId,
        ),
      }));

      toast.error("Failed to create column");
    },
  });

function addField(type: FormField["type"]) {
  const field: FormField = {
    id: crypto.randomUUID(),

    name: getDefaultLabel(type),

    type,

    required: false,

    placeholder: "",

    columnId: undefined,

    ...(type === "STATUS"
      ? {
          options: [
            {
              id: crypto.randomUUID(),
              label: "Option 1",
              value: "option-1",
              color: "#6366f1",
              isNew: true,
            },
          ],
        }
      : {}),
  };

  setForm((current) => ({
    ...current,
    fields: [...current.fields, field],
  }));

  createColumnMutation.mutate({
    type,
    fieldId: field.id,
  });
}

  function updateField(updatedField: FormField) {
    setForm((current) => ({
      ...current,

      fields: current.fields.map((field) =>
        field.id === updatedField.id ? updatedField : field,
      ),
    }));
  }

  function deleteField(fieldId: string) {
    setForm((current) => ({
      ...current,

      fields: current.fields.filter((field) => field.id !== fieldId),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setForm((current) => {
      const oldIndex = current.fields.findIndex(
        (field) => field.id === active.id,
      );

      const newIndex = current.fields.findIndex(
        (field) => field.id === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) {
        return current;
      }

      return {
        ...current,

        fields: arrayMove(current.fields, oldIndex, newIndex),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Form</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Create a form that employees can use to submit requests to this board.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <label className="text-sm font-medium">Form title</label>

          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Employee Request Form"
            className="mt-2 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Tell employees what this form is for..."
            className="mt-2 min-h-24 w-full rounded-md border px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Form fields</h2>

            <p className="text-sm text-muted-foreground">
              Existing board columns are included by default. Remove any fields
              you don't need.
            </p>
          </div>

          {/* This now only adds NEW custom fields */}
          <AddFieldMenu onAdd={addField} />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={form.fields.map((field) => field.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {form.fields.map((field) => (
                <FormFieldCard
                  key={field.id}
                  field={field}
                  onChange={updateField}
                  onDelete={() => deleteField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {form.fields.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No fields added yet.
            </p>

            <div className="mt-4">
              <AddFieldMenu onAdd={addField} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Convert all existing board columns into form fields.
 */
function mapBoardColumnsToFields(columns: any[]): FormField[] {
  return columns.map((column) => {
    const type = mapColumnTypeToFormType(column.type);

    const field: FormField = {
      id: crypto.randomUUID(),

      name: column.name,

      type,

      required: false,

      placeholder: "",

      columnId: column.id,
    };

    if (column.type === "STATUS") {
      field.options = (column.statusOptions ?? []).map((option: any) => ({
        id: String(option.id),
        label: option.label,
        value: option.value ?? option.label?.toLowerCase().replace(/\s+/g, "-"),
        color: option.color ?? "#6366f1",
        isNew: false,
      }));
    }

    return field;
  });
}

/**
 * Board column type -> Form field type
 */
function mapColumnTypeToFormType(columnType: string): FormField["type"] {
  switch (columnType) {
    case "TEXT":
      return "TEXT";

    case "NUMBER":
      return "NUMBER";

    case "DATE":
      return "DATE";

    case "STATUS":
      return "STATUS";

    case "CHECKBOX":
      return "CHECKBOX";

    default:
      return "TEXT";
  }
}

function getDefaultLabel(type: FormField["type"]) {
  switch (type) {
    case "TEXT":
      return "Text";

    case "NUMBER":
      return "Number";

    case "DATE":
      return "Date";

    case "CHECKBOX":
      return "Checkbox";

    case "STATUS":
      return "Status";
    default:
      return "Label";
  }
}
