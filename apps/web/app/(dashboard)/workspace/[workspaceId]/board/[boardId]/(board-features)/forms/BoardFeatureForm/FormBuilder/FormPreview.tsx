"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormBuilderState, FormField, FormFieldType } from "./board-feature-form.types";
import { SYSTEM_COLUMN_TYPES } from "./board-form.utils";

export interface FormDesign {
  position: "left" | "center" | "right";
  bgColor: string;
  accentColor: string;
  cardBg: string;
  textColor: string;
  logoUrl?: string | null;
}

export const DEFAULT_DESIGN: FormDesign = {
  position: "center",
  bgColor: "#f5f6f8",
  accentColor: "#0070f3",
  cardBg: "#ffffff",
  textColor: "#111827",
};

interface FormPreviewProps {
  form: FormBuilderState;
  design?: FormDesign;
  /** When true, fills the available height (used inside the builder preview panel) */
  fill?: boolean;
}

export function FormPreview({ form, design = DEFAULT_DESIGN, fill }: FormPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const visibleFields = useMemo(
    () => form.fields.filter((f) => !f.hidden && !SYSTEM_COLUMN_TYPES.has(f.columnType ?? "")),
    [form.fields],
  );

  // Group fields by pageIndex — mirrors the decodePageIndex logic in PublicBoardForm
  const pages = useMemo(() => {
    const maxPage = visibleFields.reduce((m, f) => Math.max(m, f.pageIndex ?? 0), 0);
    const grouped: typeof visibleFields[] = Array.from({ length: maxPage + 1 }, () => []);
    for (const f of visibleFields) grouped[f.pageIndex ?? 0].push(f);
    return grouped;
  }, [visibleFields]);

  const totalPages = pages.length;
  const safePage = Math.min(currentPage, totalPages - 1);
  const isLastPage = safePage === totalPages - 1;
  const pageFields = pages[safePage] ?? [];

  const justifyClass =
    design.position === "left" ? "justify-start"
    : design.position === "right" ? "justify-end"
    : "justify-center";

  return (
    <div
      className={cn("flex w-full px-8 py-8", justifyClass, fill && "min-h-full")}
      style={{ backgroundColor: design.bgColor }}
    >
      <div className="w-full max-w-2xl">
        {/* Progress bar — only for multi-page forms */}
        {totalPages > 1 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {safePage + 1} of {totalPages}</span>
              <span>{Math.round(((safePage + 1) / totalPages) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((safePage + 1) / totalPages) * 100}%`, backgroundColor: design.accentColor }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl shadow-lg"
          style={{ backgroundColor: design.cardBg, color: design.textColor }}
        >
          {/* Accent top bar */}
          <div className="h-2 rounded-t-2xl" style={{ backgroundColor: design.accentColor }} />

          <div className="px-8 pb-8 pt-7">
            {/* Logo + Title + description — only on first page */}
            {safePage === 0 && (
              <div className="mb-7 space-y-1.5">
                {design.logoUrl && (
                  <img
                    src={design.logoUrl}
                    alt="Form logo"
                    className="mb-3 max-h-14 max-w-[160px] object-contain"
                  />
                )}
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: design.textColor }}>
                  {form.name || <span className="italic opacity-30">Form title</span>}
                </h1>
                {form.description && (
                  <p className="text-sm" style={{ color: design.textColor, opacity: 0.6 }}>
                    {form.description}
                  </p>
                )}
              </div>
            )}

            {/* Page label for non-first pages */}
            {totalPages > 1 && safePage > 0 && (
              <div className="mb-5">
                <h2 className="text-lg font-semibold" style={{ color: design.textColor }}>
                  {form.pages[safePage]?.title ?? `Page ${safePage + 1}`}
                </h2>
              </div>
            )}

            {/* Fields */}
            <div className="space-y-5">
              {pageFields.length === 0 && (
                <p className="py-6 text-center text-sm italic opacity-40" style={{ color: design.textColor }}>
                  No visible fields — toggle the eye icon to show fields.
                </p>
              )}
              {pageFields.map((field) => (
                <PreviewField key={field.id} field={field} design={design} />
              ))}
            </div>

            {/* Navigation */}
            <div className="mt-7 flex items-center justify-between gap-3">
              {safePage > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted/30"
                  style={{ color: design.textColor, borderColor: `${design.textColor}30` }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {isLastPage ? (
                <button
                  type="button"
                  disabled
                  className="flex flex-1 cursor-default items-center justify-center rounded-lg py-3 text-base font-semibold text-white opacity-90"
                  style={{ backgroundColor: design.accentColor }}
                >
                  {form.submitLabel || "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: design.accentColor }}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs opacity-50" style={{ color: design.textColor }}>
          <div className="grid h-4 w-4 grid-cols-2 gap-[1.5px] rotate-45">
            <div className="rounded-[1px] bg-[#FF3D57]" />
            <div className="rounded-[1px] bg-[#00CFF4]" />
            <div className="rounded-[1px] bg-[#FFCB00]" />
            <div className="rounded-[1px] bg-[#00C875]" />
          </div>
          <span>Powered by <strong>EzManage</strong></span>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ field, design }: { field: FormField; design: FormDesign }) {
  const label = field.name || field.type;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{ color: design.textColor }}>
        {label}
        {field.required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>
      {field.description && (
        <p className="text-xs opacity-50" style={{ color: design.textColor }}>
          {field.description}
        </p>
      )}
      <FieldInput type={field.type} field={field} />
    </div>
  );
}

function FieldInput({ type, field }: { type: FormFieldType; field: FormField }) {
  const inputBase =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground/60 pointer-events-none select-none";

  switch (type) {
    case "TEXT":
    case "LONG_TEXT":
    case "LINK":
      return (
        <div className={cn(inputBase, type === "LONG_TEXT" && "min-h-[72px]")}>
          {type === "LINK" ? (
            <span className="flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-muted-foreground/40" />
              https://
            </span>
          ) : (
            <span>Type your answer…</span>
          )}
        </div>
      );

    case "NUMBER":
      return <div className={inputBase}>0</div>;

    case "DATE":
      return (
        <div className={`${inputBase} flex items-center justify-between`}>
          <span>Pick a date</span>
          <Calendar className="h-4 w-4 text-muted-foreground/40" />
        </div>
      );

    case "TIMELINE":
      return (
        <div className="grid grid-cols-2 gap-3">
          {["Start date", "End date"].map((ph) => (
            <div key={ph} className={`${inputBase} flex items-center justify-between`}>
              <span>{ph}</span>
              <Calendar className="h-4 w-4 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      );

    case "STATUS":
      return (
        <div className={`${inputBase} flex items-center justify-between`}>
          <span>{field.options?.[0]?.label ? `${field.options[0].label}…` : "Select…"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
        </div>
      );

    case "CHECKBOX":
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-input bg-background" />
          <span className="text-sm text-muted-foreground/60">Check to confirm</span>
        </div>
      );

    case "FILE":
      return (
        <div className={`${inputBase} flex items-center gap-2`}>
          <Paperclip className="h-4 w-4 text-muted-foreground/40" />
          <span>Choose file…</span>
        </div>
      );

    default:
      return <div className={inputBase}>…</div>;
  }
}
