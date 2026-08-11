"use client";

import { cn } from "@/lib/utils";

interface FormFieldWrapperProps {
  id: string;
  label: string;
  description?: string | null;
  required?: boolean;
  error?: string;
  /** When true, renders a side-by-side layout for checkboxes */
  inline?: boolean;
  children: React.ReactNode;
}

/**
 * Shared layout wrapper for every public form field.
 * Handles label, description, required asterisk, and validation error.
 */
export function FormFieldWrapper({
  id,
  label,
  description,
  required,
  error,
  inline = false,
  children,
}: FormFieldWrapperProps) {
  if (inline) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          {children}

          <div className="space-y-0.5 leading-none">
            <label
              htmlFor={id}
              className="cursor-pointer text-sm font-medium"
            >
              {label}

              {required && (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              )}
            </label>

            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <label
          htmlFor={id}
          className={cn("text-sm font-medium", error && "text-destructive")}
        >
          {label}

          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {children}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
