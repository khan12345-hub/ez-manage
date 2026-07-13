import { Controller, useFormContext } from "react-hook-form";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FormRadioTypes } from "./fields.types";
import { cn } from "@/lib/utils";

const gapMap = {
  "2": "gap-2",
  "2.5": "gap-2.5",
  "3": "gap-3",
  "4": "gap-4",
};

const gridColsMap = {
  "1": "grid-cols-1",
  "2": "grid-cols-2",
  "3": "grid-cols-3",
  "4": "grid-cols-4",
};

export function FormRadio({
  name,
  label,
  options,
  className,
  disabled,
  gridCols = "2",
  gap = "2.5",
}: FormRadioTypes) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          {label && <FieldLabel>{label}</FieldLabel>}

          <div
            className={cn(
              "grid",
              gapMap[gap as keyof typeof gapMap],
              gridColsMap[gridCols as keyof typeof gridColsMap],
              className
            )}
          >
            {options.map((option) => {
              const isSelected = field.value === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500/70 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => field.onChange(option.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {option.icon && <span>{option.icon}</span>}
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="text-xs leading-4 text-gray-500 dark:text-zinc-500">
                      {option.description}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}
