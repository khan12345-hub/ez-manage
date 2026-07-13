import { Controller, useFormContext } from "react-hook-form";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FormSelectTypes } from "./fields.types";
import { cn } from "@/lib/utils";

export function FormSelect({
  name,
  label,
  options,
  placeholder = "Select an option",
  valueType = "string",
  className,
  labelClassName,
  wrapperClassName,
  disabled,
  show = true,
  optionClassName,
  ...props
}: FormSelectTypes) {
  const { control } = useFormContext();

  if (!show) return null;
  console.log("OPTIONS", options)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // Handle value conversion depending on valueType
        const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const rawValue = e.target.value;
          if (rawValue === "") {
            field.onChange(null);
          } else {
            const convertedValue = valueType === "number" ? Number(rawValue) : rawValue;
            field.onChange(convertedValue);
          }
        };

        return (
          <Field className={wrapperClassName}>
            {label && (
              <FieldLabel htmlFor={name} className={labelClassName}>
                {label}
              </FieldLabel>
            )}

            <div className="relative w-full">
              <select
                id={name}
                {...field}
                value={field.value ?? ""}
                onChange={handleChange}
                disabled={disabled}
                aria-invalid={!!fieldState.error}
                className={cn(
                  "h-8 w-full min-w-0 capitalize rounded-xs border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none appearance-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 pr-8",
                  className
                )}
                {...props}
              >
                {placeholder && (
                  <option value="" disabled className="text-muted-foreground bg-white dark:bg-zinc-900">
                    {placeholder}
                  </option>
                )}
                {options.map((opt) => (
                  <option
                    key={valueType === 'number' ? opt.id : opt.value}
                    value={valueType === 'number' ? opt.id : opt.value}
                    className={cn("bg-white dark:bg-zinc-900 text-foreground capitalize", optionClassName)}
                  >
                    {opt.name.toLowerCase()}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </Field>
        );
      }}
    />
  );
}
