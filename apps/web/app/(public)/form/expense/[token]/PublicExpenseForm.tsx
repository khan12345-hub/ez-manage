"use client";

/* Public, shareable reimbursement form. Anyone with the link can VIEW it; only a
   logged-in EZ Manage user can submit (the API's POST /expenses/form/:token needs a
   session — an anonymous submit gets 401, and we surface a "log in to submit" prompt). */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LogIn, Receipt } from "lucide-react";
import { toast } from "sonner";
import { resolveUrl } from "@/lib/resolveUrl";
import { expensesApi } from "@/services/expenses.api";
import { getMe } from "@/services/auth/auth.api";
import {
  FieldInput, FormField as FormFieldRow, collect, emptyValues, type FieldValues,
} from "@/app/(dashboard)/workspace/[workspaceId]/expenses/ExpenseFormParts";

export function PublicExpenseForm({ token }: { token: string }) {
  const { data: form, isLoading, isError } = useQuery({ queryKey: ["public-expense-form", token], queryFn: () => expensesApi.formByToken(token), retry: false });
  const { data: me } = useQuery({ queryKey: ["me-lite"], queryFn: () => getMe().catch(() => null), retry: false });
  const [values, setValues] = useState<FieldValues>({});
  const [done, setDone] = useState(false);
  const loggedIn = !!me;

  const seeded = useMemo(() => (form ? emptyValues(form.fields) : {}), [form]);
  const vals = Object.keys(values).length ? values : seeded;
  const set = (key: string, v: unknown) => setValues({ ...vals, [key]: v });

  const submit = useMutation({
    mutationFn: async () => {
      const c = collect(form!.fields, vals);
      if (!c.ok) throw new Error(c.error);
      // the mapped answers + custom go in `values`; files ride along as receipts
      const payload: Record<string, unknown> = { ...c.custom };
      for (const f of form!.fields) {
        if (f.type === "file") continue;
        if (f.maps && vals[f.key] != null && vals[f.key] !== "") payload[f.key] = vals[f.key];
      }
      return expensesApi.submitViaForm(token, payload, c.files);
    },
    onSuccess: () => { setDone(true); },
    onError: (e: any) => {
      if (e?.response?.status === 401) toast.error("Please log in to submit this claim.");
      else toast.error(e?.response?.data?.message ?? e?.message ?? "Couldn't submit.");
    },
  });

  const loginHref = `/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef1f6] to-[#f6f7f9] px-4 py-10 dark:from-neutral-950 dark:to-neutral-900">
      <div className="mx-auto w-full max-w-xl">
        {isLoading ? (
          <div className="flex h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : isError || !form ? (
          <Shell><div className="px-6 py-14 text-center"><Receipt className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-[16px] font-semibold">This form isn’t available</p><p className="mt-1 text-[13.5px] text-muted-foreground">The link may be closed or incorrect.</p></div></Shell>
        ) : done ? (
          <Shell>
            <Hero form={form} />
            <div className="px-6 pb-10 pt-2 text-center sm:px-8">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-[17px] font-semibold">Claim submitted</p>
              <p className="mt-1.5 text-[13.5px] text-muted-foreground">Thanks — {form.company ?? "the team"} will review your reimbursement. You’ll be notified of any updates.</p>
              <button type="button" onClick={() => { setDone(false); setValues({}); }} className="mt-6 h-10 rounded-xl border border-border px-5 text-[13.5px] font-medium hover:bg-accent">Submit another claim</button>
            </div>
          </Shell>
        ) : (
          <Shell>
            <Hero form={form} />
            <div className="px-6 pb-8 pt-1 sm:px-8">
              {!loggedIn && (
                <a href={loginHref} className="mb-5 flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3 text-[13px] hover:bg-primary/10">
                  <LogIn className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">Fill this in now — you’ll just need to <span className="font-semibold text-foreground">log in to submit</span>.</span>
                </a>
              )}
              <div className="space-y-4">
                {form.fields.map((f) => <FormFieldRow key={f.key} field={f}><FieldInput field={f} value={vals[f.key]} onChange={(v) => set(f.key, v)} /></FormFieldRow>)}
              </div>
              <button type="button" onClick={() => (loggedIn ? submit.mutate() : (window.location.href = loginHref))}
                disabled={submit.isPending}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50">
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : loggedIn ? "Submit claim" : <><LogIn className="h-4 w-4" /> Log in to submit</>}
              </button>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">Powered by EZ Manage · Reimbursements</p>
            </div>
          </Shell>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-[0_8px_40px_-12px_rgba(0,0,0,0.18)]">{children}</div>;
}

/** Branded hero: banner, overlapping logo, centered title + company + description. */
function Hero({ form }: { form: { title: string; description: string | null; logoUrl: string | null; bannerUrl: string | null; company?: string } }) {
  return (
    <div>
      <div className="relative h-28 w-full sm:h-32" style={{ background: form.bannerUrl ? undefined : "linear-gradient(120deg,var(--primary),color-mix(in oklab,var(--primary),#000 30%))" }}>
        {form.bannerUrl && <img src={resolveUrl(form.bannerUrl)} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="px-6 pb-4 text-center sm:px-8">
        <div className={form.logoUrl ? "-mt-9" : "pt-4"}>
          {form.logoUrl && <img src={resolveUrl(form.logoUrl)} alt="" className="mx-auto h-[72px] w-[72px] rounded-2xl border-4 border-background bg-background object-cover shadow-sm" />}
        </div>
        <h1 className="mt-3 text-[20px] font-semibold tracking-tight sm:text-[22px]">{form.title || "Reimbursements"}</h1>
        {form.company && <p className="mt-0.5 text-[12.5px] font-medium text-muted-foreground">{form.company}</p>}
        {form.description && <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{form.description}</p>}
      </div>
    </div>
  );
}
