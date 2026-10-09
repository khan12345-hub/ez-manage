"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
  user,
  formTitle,
  formDescription,
  formLogoUrl,
  children,
}: {
  d: FormDesign;
  user?: { firstName?: string; lastName?: string; avatarUrl?: string | null } | null;
  formTitle?: string | null;
  formDescription?: string | null;
  formLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: d.bgColor, color: d.textColor }}>
      {/* EzManage top nav */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-black/10 bg-white/90 px-6 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid h-6 w-6 grid-cols-2 gap-[2px] rotate-45">
            <div className="rounded-[2px] bg-[#FF3D57]" />
            <div className="rounded-[2px] bg-[#00CFF4]" />
            <div className="rounded-[2px] bg-[#FFCB00]" />
            <div className="rounded-[2px] bg-[#00C875]" />
          </div>
          <span className="text-sm font-bold tracking-tight">EzManage</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: d.accentColor }}>
                {initials}
              </div>
            )}
            <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
          </div>
        )}
      </header>

      {/* Sticky form identity bar — sits just below the EzManage nav */}
      {formTitle && (
        <div
          className="sticky top-12 z-40 border-b border-black/10 bg-white/95 px-6 py-3 shadow-sm backdrop-blur-sm"
          style={{ color: d.textColor }}
        >
          <div
            className="mx-auto flex max-w-2xl items-center gap-3"
            style={{
              justifyContent:
                d.position === "left" ? "flex-start"
                : d.position === "right" ? "flex-end"
                : "flex-start",
            }}
          >
            {formLogoUrl && (
              <img
                src={formLogoUrl}
                alt="Form logo"
                className="h-9 max-w-[120px] flex-shrink-0 rounded object-contain"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{formTitle}</p>
              {formDescription && (
                <p className="truncate text-xs text-muted-foreground">{formDescription}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable form content */}
      <div
        className="flex min-h-[calc(100vh-48px)] items-start px-4 pb-24 pt-8"
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
  }

  function validatePage(fields: typeof pageFields): boolean {
    const nextErrors: Record<number, string> = {};
    fields.forEach((field) => {
      if (!field.required) return;
      const value = values[field.id];
      const type = field.column.type.toUpperCase();
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (type === "TIMELINE" && !isEmpty) {
        const tv = value as { startDate?: string; endDate?: string };
        if (!tv.startDate || !tv.endDate) {
          nextErrors[field.id] = "Both start and end dates are required";
          return;
        }
      }
      if (isEmpty) nextErrors[field.id] = "This field is required";
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleNext() {
    if (!validatePage(pageFields)) return;
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
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
          const val = values[f.id];
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
      <PageShell d={d} user={user}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading form…</p>
        </div>
      </PageShell>
    );
  }

  if (isError || !form) {
    return (
      <PageShell d={d} user={user}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <h1 className="text-lg font-semibold">Form not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This form does not exist or is unavailable.</p>
        </div>
      </PageShell>
    );
  }

  if (!form.isActive) {
    return (
      <PageShell d={d} user={user}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-10 text-center shadow-lg dark:bg-[#2b2c30]">
          <h1 className="text-lg font-semibold">Form unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This form is currently inactive.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      d={d}
      user={user}
      formTitle={form.title || "Submit Form"}
      formDescription={form.description}
      formLogoUrl={d.logoUrl}
    >
      <div className="w-full max-w-2xl">
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
        <div className="rounded-2xl shadow-lg" style={{ backgroundColor: d.cardBg, color: d.textColor }}>
          <div className="h-2 rounded-t-2xl" style={{ backgroundColor: d.accentColor }} />

          <div className="px-8 pb-8 pt-7">
            {/* Logo + Title + description on first page */}
            {currentPage === 0 && (
              <div className="mb-7 space-y-1.5">
                {d.logoUrl && (
                  <img
                    src={d.logoUrl}
                    alt="Form logo"
                    className="mb-3 max-h-16 max-w-[180px] object-contain"
                  />
                )}
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: d.textColor }}>
                  {form.title || "Submit Form"}
                </h1>
                {form.description && (
                  <p className="text-sm" style={{ color: d.textColor, opacity: 0.65 }}>{form.description}</p>
                )}
              </div>
            )}

            {/* Multi-page: show page label if > 1 page and not page 0 */}
            {totalPages > 1 && currentPage > 0 && (
              <div className="mb-5">
                <h2 className="text-lg font-semibold" style={{ color: d.textColor }}>
                  Page {currentPage + 1}
                </h2>
              </div>
            )}

            {/* Fields — form id used by the fixed submit bar below */}
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
        </div>

        {/* Footer branding */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <div className="grid h-4 w-4 grid-cols-2 gap-[1.5px] rotate-45">
            <div className="rounded-[1px] bg-[#FF3D57]" />
            <div className="rounded-[1px] bg-[#00CFF4]" />
            <div className="rounded-[1px] bg-[#FFCB00]" />
            <div className="rounded-[1px] bg-[#00C875]" />
          </div>
          <span>Powered by <strong>EzManage</strong></span>
        </div>
      </div>

      {/* ── Fixed bottom bar: Back / Next / Submit ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div
          className="mx-auto flex max-w-2xl items-center gap-3"
          style={{
            justifyContent:
              d.position === "left" ? "flex-start"
              : d.position === "right" ? "flex-end"
              : "center",
          }}
        >
          {currentPage > 0 ? (
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
          ) : (
            <div />
          )}

          {isLastPage ? (
            <button
              type="submit"
              form="public-board-form"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center rounded-lg py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: d.accentColor }}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.submitLabel || "Submit"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: d.accentColor }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
