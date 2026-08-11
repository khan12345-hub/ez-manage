"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { PublicBoardFormField } from "@/services/board-form.api";

interface PublicFormFieldProps {
  field: PublicBoardFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function PublicFormField({
  field,
  value,
  onChange,
}: PublicFormFieldProps) {
  const label = field.label || field.column.name;

  return (
    <div className="space-y-2">
      <div>
        <Label>
          {label}

          {field.required && (
            <span className="ml-1 text-destructive">
              *
            </span>
          )}
        </Label>

        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </div>

      {field.column.type === "TEXT" && (
        <Input
          value={String(value ?? "")}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={field.column.name}
        />
      )}

      {field.column.type === "NUMBER" && (
        <Input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? null
                : Number(event.target.value),
            )
          }
        />
      )}

      {field.column.type === "DATE" && (
        <Input
          type="date"
          value={
            value instanceof Date
              ? value.toISOString().split("T")[0]
              : String(value ?? "")
          }
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      )}

      {field.column.type === "CHECKBOX" && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) =>
              onChange(checked === true)
            }
          />

          <span className="text-sm">
            {label}
          </span>
        </div>
      )}

      {field.column.type === "STATUS" && (
        <div className="space-y-2">
          {field.column.statusOptions?.map(
            (option) => (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  onChange(option.value)
                }
                className={`flex w-full items-center gap-2 rounded-md border p-3 text-left transition ${
                  value === option.value
                    ? "border-primary bg-accent"
                    : "hover:bg-accent"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: option.color,
                  }}
                />

                <span className="text-sm">
                  {option.label}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}