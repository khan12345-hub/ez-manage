"use client";

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

import { FormField } from "./board-feature-form.types";

import { AddFieldMenu, ALLOWED_FORM_FIELDS } from "./AddFieldMenu";
import { FormFieldCard } from "./FormFieldCard";

interface FormFieldsSectionProps {
  fields: FormField[];

  onAdd: (type: FormField["type"]) => void;

  onChange: (field: FormField) => void;

  onDelete: (fieldId: string) => void;

  onReorder: (fields: FormField[]) => void;
}

export function FormFieldsSection({
  fields,
  onAdd,
  onChange,
  onDelete,
  onReorder,
}: FormFieldsSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );
  console.log({ fields });
  const allowedFields = fields.filter((field) =>
    ALLOWED_FORM_FIELDS.some(
      (allowedField) => allowedField.type === field.type,
    ),
  );
  console.log({ allowedFields });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = allowedFields.findIndex((field) => field.id === active.id);

    const newIndex = allowedFields.findIndex((field) => field.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(allowedFields, oldIndex, newIndex).map(
      (field, index) => ({
        ...field,
        position: index,
      }),
    );

    onReorder(reordered);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Form fields</h2>

          <p className="text-sm text-muted-foreground">
            Existing board columns are included by default.
          </p>
        </div>

        <AddFieldMenu onAdd={onAdd} />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allowedFields.map((field) => field.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {allowedFields.map((field) => (
              <FormFieldCard
                key={field.id}
                field={field}
                onChange={onChange}
                onDelete={() => onDelete(field.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!allowedFields.length && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No fields added yet.</p>

          <div className="mt-4">
            <AddFieldMenu onAdd={onAdd} />
          </div>
        </div>
      )}
    </section>
  );
}
