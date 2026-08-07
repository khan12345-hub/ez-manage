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
import { FormSettings } from "./FormSettings";




interface FormBuilderProps {
  boardId: number;
  groups: {
    id: number;
    name: string;
  }[];
}

export function FormBuilder({
  boardId,
  groups,
}: FormBuilderProps) {
  const [form, setForm] = useState<FormBuilderState>({
    name: "",
    description: "",
    groupId: null,
    fields: [],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  function addField(type: FormField["type"]) {
    const field: FormField = {
      id: crypto.randomUUID(),
      label: getDefaultLabel(type),
      type,
      required: false,
      placeholder: "",
      ...(type === "SELECT"
        ? {
            options: [
              {
                id: crypto.randomUUID(),
                label: "Option 1",
                value: "option-1",
              },
            ],
          }
        : {}),
    };

    setForm((current) => ({
      ...current,
      fields: [...current.fields, field],
    }));
  }

  function updateField(updatedField: FormField) {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.id === updatedField.id
          ? updatedField
          : field
      ),
    }));
  }

  function deleteField(fieldId: string) {
    setForm((current) => ({
      ...current,
      fields: current.fields.filter(
        (field) => field.id !== fieldId
      ),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setForm((current:any) => {
      const oldIndex = current.fields.findIndex(
        (field:any) => field.id === active.id
      );

      const newIndex = current.fields.findIndex(
        (field:any) => field.id === over.id
      );

      return {
        ...current,
        fields: arrayMove(
          current.fields,
          oldIndex,
          newIndex
        ),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Create Form
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Create a form that employees can use to submit
          requests to this board.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Form title
          </label>

          <input
            value={form.name}
            onChange={(event) =>
              setForm((current:any) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Employee Request Form"
            className="mt-2 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Description
          </label>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current:any) => ({
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
            <h2 className="font-semibold">
              Form fields
            </h2>

            <p className="text-sm text-muted-foreground">
              Each field will become a column on this board.
            </p>
          </div>

          <AddFieldMenu onAdd={addField} />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={form.fields.map((field:any) => field.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {form.fields.map((field:any) => (
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

      <FormSettings
        groups={groups}
        groupId={form.groupId}
        onGroupChange={(groupId) =>
          setForm((current) => ({
            ...current,
            groupId,
          }))
        }
      />
    </div>
  );
}

function getDefaultLabel(
  type: FormField["type"]
) {
  switch (type) {
    case "TEXT":
      return "Short Text";

    case "TEXTAREA":
      return "Description";

    case "EMAIL":
      return "Email";

    case "NUMBER":
      return "Number";

    case "DATE":
      return "Date";

    case "SELECT":
      return "Select";

    case "CHECKBOX":
      return "Checkbox";
  }
}