"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getMe } from "@/services/auth/auth.api";

import {
  getPublicBoardForm,
  submitBoardForm,
  type PublicBoardForm as PublicBoardFormData,
  type SubmitBoardFormPayload,
  type FormDesign,
} from "@/services/board-form.api";

const DEFAULT_DESIGN: FormDesign = {
  position: "center",
  bgColor: "#f5f6f8",
  accentColor: "#0070f3",
  cardBg: "#ffffff",
  textColor: "#111827",
};

import { PublicFormFieldRenderer } from "./components/PublicFormFieldRenderer";

function PageShell({
  d,
  children,
}: {
  d: FormDesign;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden" style={{ backgroundColor: d.bgColor, color: d.textColor }}>
      <div
        className="flex h-full items-start px-4 py-8"
        style={{
          justifyContent:
            d.position === "left" ? "flex-start"
            : d.position === "right" ? "flex-end"
            : "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface PublicBoardFormProps {
  /** Numeric board ID (legacy /form/17) or UUID share token (/form/550e8400-...) */
  identifier: string | number;
}

type FormValues = Record<number, unknown>;

/** Decode encoded position (pageIndex * 1000 + localIndex) back to pageIndex */
function decodePageIndex(position: number): number {
  return Math.floor(position / 1000);
}

export function PublicBoardForm({ identifier }: PublicBoardFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [validationBanner, setValidationBanner] = useState<string[] | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  /* ── Logged-in user (optional) ── */
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });

  /* ── Fetch form definition ── */
  const {
    data: form,
    isLoading,
    isError,
  } = useQuery<PublicBoardFormData>({
    queryKey: ["public-board-form", identifier],
    queryFn: () => getPublicBoardForm(identifier),
    enabled: Boolean(identifier),
    retry: false,
  });

  /* ── Submit mutation ── */
  const { mutate: submit, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: SubmitBoardFormPayload) =>
      submitBoardForm(identifier, payload),
    onSuccess: () => {
      router.push(`/form/thank-you?ref=${identifier}`);
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  /* ── Derive pages from field positions ── */
  const { pages, visibleFields } = useMemo(() => {
    if (!form?.fields) return { pages: [[]], visibleFields: [] };
    const allVisible = [...form.fields]
      .filter((f) => !f.hidden)
      .sort((a, b) => a.position - b.position);

    // Detect max page
    const maxPage = allVisible.reduce(
      (m, f) => Math.max(m, decodePageIndex(f.position)),
      0,
    );

    const grouped: typeof allVisible[] = Array.from({ length: maxPage + 1 }, () => []);
    for (const f of allVisible) {
      grouped[decodePageIndex(f.position)].push(f);
    }

    return { pages: grouped, visibleFields: allVisible };
  }, [form?.fields]);

  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;
  const pageFields = pages[currentPage] ?? [];

  /* ── Helpers ── */
  function setFieldValue(fieldId: number, value: unknown) {
    setValues((current) => ({ ...current, [fieldId]: value }));
    setErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setValidationBanner((b) => {
      if (!b) return null;
      // Remove dismissed banner when the user starts fixing errors
      return b.length <= 1 ? null : b;
    });
  }

  function validatePage(fields: typeof pageFields): boolean {
    const nextErrors: Record<number, string> = {};
    const missingLabels: string[] = [];

    fields.forEach((field) => {
      if (!field.required) return;
      const value = values[field.id];
      const type = field.column.type.toUpperCase();
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (field.multiSelect && (!Array.isArray(value) || value.length === 0));
      if (type === "TIMELINE" && !isEmpty) {
        const tv = value as { startDate?: string; endDate?: string };
        if (!tv.startDate || !tv.endDate) {
          nextErrors[field.id] = "Both start and end dates are required";
          missingLabels.push(field.label ?? field.column.name);
          return;
        }
      }
      if (isEmpty) {
        nextErrors[field.id] = "This field is required";
        missingLabels.push(field.label ?? field.column.name);
      }
    });

    setErrors(nextErrors);

    if (missingLabels.length > 0) {
      setValidationBanner(missingLabels);
      // Scroll banner into view
      setTimeout(() => {
        bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return false;
    }

    setValidationBanner(null);
    return true;
  }

  function handleNext() {
    if (!validatePage(pageFields)) return;
    setValidationBanner(null);
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setValidationBanner(null);
    setCurrentPage((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validatePage(pageFields)) return;

    const primaryField = visibleFields.find((field) => field.column.isPrimary);
    const taskName = primaryField
      ? String(values[primaryField.id] ?? "").trim()
      : "";

    const payload: SubmitBoardFormPayload = {
      ...(taskName ? { taskName } : {}),
      values: visibleFields
        .filter((f) => values[f.id] !== undefined && values[f.id] !== "")
        .map((f) => {
          let val = values[f.id];
          const colType = f.column.type.toUpperCase();

          // For multi-select LABEL/STATUS fields, convert string[] → [{text,color}]
          if (f.multiSelect && Array.isArray(val) && (colType === "LABEL" || colType === "STATUS" || colType === "DROPDOWN")) {
            const opts = f.column.statusOptions ?? [];
            val = (val as string[]).map((label) => {
              const opt = opts.find((o) => o.label === label);
              return { text: label, color: opt?.color ?? "#e2e8f0" };
            });
          }

          return { columnId: f.columnId, value: val };
        }),
    };

    submit(payload);
  }

  /* ── Resolved design ── */
  const d: FormDesign = form?.design
    ? { ...DEFAULT_DESIGN, ...(form.design as Partial<FormDesign>) }
    : DEFAULT_DESIGN;

  if (isLoading) {
    return (
      <PageShell d={d}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading form…</p>
        </div>
      </PageShell>
    );
  }

  if (isError || !form) {
    return (
      <PageShell d={d}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <h1 className="text-lg font-semibold">Form not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This form does not exist or is unavailable.</p>
        </div>
      </PageShell>
    );
  }

  if (!form.isActive) {
    return (
      <PageShell d={d}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <h1 className="text-lg font-semibold">Form unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This form is currently inactive.</p>
        </div>
      </PageShell>
    );
  }

  const userInitials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <PageShell d={d}>
      <div className="flex h-full w-full max-w-2xl flex-col">
        {/* Progress bar — only shown for multi-page forms */}
        {totalPages > 1 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {currentPage + 1} of {totalPages}</span>
              <span>{Math.round(((currentPage + 1) / totalPages) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentPage + 1) / totalPages) * 100}%`, backgroundColor: d.accentColor }}
              />
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="flex h-full flex-col overflow-hidden rounded-2xl shadow-lg" style={{ backgroundColor: d.cardBg, color: d.textColor }}>
          {/* Accent bar */}
          <div className="h-2 shrink-0 rounded-t-2xl" style={{ backgroundColor: d.accentColor }} />

          {/* Sticky header — logo, user, title, description */}
          <div className="shrink-0 border-b px-8 pb-5 pt-6" style={{ borderColor: `${d.textColor}12` }}>
            {/* Top row: logo (left) + user + ? (right) */}
            <div className="mb-3 flex items-start justify-between gap-4">
              {d.logoUrl ? (
                <img
                  src={d.logoUrl}
                  alt="Form logo"
                  className="max-h-12 max-w-[140px] object-contain"
                />
              ) : (
                <div />
              )}
              <div className="flex shrink-0 items-center gap-2">
                {user && (
                  <>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: d.accentColor }}
                      >
                        {userInitials}
                      </div>
                    )}
                    <span className="text-sm font-medium" style={{ color: d.textColor }}>
                      {user.firstName} {user.lastName}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  title="Form info"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold hover:bg-black/5"
                  style={{ borderColor: `${d.textColor}30`, color: d.textColor }}
                >
                  ?
                </button>
              </div>
            </div>

            {/* Title + description */}
            <h1 className="text-xl font-bold tracking-tight" style={{ color: d.textColor }}>
              {form.title || "Submit Form"}
            </h1>
            {form.description && (
              <p className="mt-0.5 text-sm font-medium" style={{ color: d.accentColor }}>
                {form.description}
              </p>
            )}

            {/* Multi-page label */}
            {totalPages > 1 && currentPage > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </p>
            )}
          </div>

          {/* Scrollable fields area */}
          <div className="flex-1 overflow-y-auto px-8 pb-6 pt-5">

            {/* Inline validation banner */}
            {validationBanner && validationBanner.length > 0 && (
              <div
                ref={bannerRef}
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Please fill in all required fields:</p>
                  <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed">
                    {validationBanner.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Fields */}
            <form id="public-board-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
              {pageFields.map((field) => (
                <PublicFormFieldRenderer
                  key={field.id}
                  field={field}
                  boardId={identifier}
                  value={values[field.id]}
                  error={errors[field.id]}
                  disabled={isSubmitting}
                  onChange={(val) => setFieldValue(field.id, val)}
                />
              ))}
            </form>
          </div>

          {/* Sticky card footer — Back / Next / Submit */}
          <div
            className="shrink-0 flex items-center justify-between gap-3 border-t px-8 py-4"
            style={{ borderColor: `${d.textColor}12`, backgroundColor: d.cardBg }}
          >
            <div>
              {currentPage > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div>
              {isLastPage ? (
                <button
                  type="submit"
                  form="public-board-form"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: d.accentColor }}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.submitLabel || "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: d.accentColor }}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating branding badge — bottom right */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 shadow-md text-xs text-muted-foreground">
        <div className="grid h-3.5 w-3.5 grid-cols-2 gap-[1.5px] rotate-45">
          <div className="rounded-[1px] bg-[#FF3D57]" />
          <div className="rounded-[1px] bg-[#00CFF4]" />
          <div className="rounded-[1px] bg-[#FFCB00]" />
          <div className="rounded-[1px] bg-[#00C875]" />
        </div>
        <span><strong>EzManage</strong> forms</span>
      </div>

    </PageShell>
  );
}
