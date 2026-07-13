"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  id: number | string;
  name: string;
}

interface FormMultiSelectProps {
  name: string;
  label?: string;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  show?: boolean;
}

export function FormMultiSelect({
  name,
  label,
  options,
  placeholder = "Select options",
  disabled,
  className,
  wrapperClassName,
  labelClassName,
  show = true,
}: FormMultiSelectProps) {
  const { control } = useFormContext();

  console.log("options", options);

  if (!show) return null;

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={[]}
      render={({ field, fieldState }) => {
        const value: (string | number)[] = field.value ?? [];
        console.log("field.value", field.value);
        const toggleOption = (id: string | number) => {
          if (value.includes(id)) {
            field.onChange(value.filter((v) => v !== id));
          } else {
            field.onChange([...value, id]);
          }
        };

        const selectedOptions = options.filter((o) => value.includes(o.id));

        return (
          <Field className={wrapperClassName}>
            {label && (
              <FieldLabel htmlFor={name} className={labelClassName}>
                {label}
              </FieldLabel>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  className={cn(
                    "min-h-9 h-auto w-full justify-between px-3",
                    fieldState.error &&
                      "border-destructive ring-destructive/20",
                    className,
                  )}
                >
                  <div className="flex flex-wrap gap-1">
                    {selectedOptions.length > 0 ? (
                      selectedOptions.map((option) => (
                        <Badge
                          key={option.id}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {option.name}

                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOption(option.id);
                            }}
                            className="cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">
                        {placeholder}
                      </span>
                    )}
                  </div>

                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search..." />

                  <CommandEmpty>No option found.</CommandEmpty>

                  <CommandGroup>
                    {options.map((option) => {
                      const selected = value.includes(option.id);

                      return (
                        <CommandItem
                          key={option.id}
                          onSelect={() => toggleOption(option.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selected ? "opacity-100" : "opacity-0",
                            )}
                          />

                          {option.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </Field>
        );
      }}
    />
  );
}
