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

const HTML_TAG_RE = /<[a-z][\s\S]*?>/i;

function Description({ text }: { text: string }) {
  const style = { color: "var(--form-accent, #6366f1)" };
  if (HTML_TAG_RE.test(text)) {
    return (
      <div
        className="text-sm font-medium [&_p]:my-0 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold [&_em]:italic"
        style={style}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }
  return <p className="text-sm font-medium" style={style}>{text}</p>;
}

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
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          {children}
          <div className="space-y-1">
            <label htmlFor={id} className="cursor-pointer text-base font-semibold text-foreground">
              {label}
              {required && (
                <span className="ml-1 text-destructive" aria-hidden="true">*</span>
              )}
            </label>
            {description && <Description text={description} />}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={cn(
          "block text-base font-semibold text-foreground",
          error && "text-destructive",
        )}
      >
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">*</span>
        )}
      </label>

      {description && <Description text={description} />}

      {children}

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
