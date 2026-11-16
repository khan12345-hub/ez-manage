"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

type Field = { id: string; label: string; type: "text" | "textarea" | "email" | "number" | "date" | "select"; required: boolean; options?: string[] };
type Form = { name: string; description: string | null; company: string | null; fields: Field[] };

/** Public Work form: anyone with the link can fill it in; each answer becomes a task. */
export default function PublicWorkFormPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data: form, isLoading, isError } = useQuery({ queryKey: ["wf", uid], queryFn: async () => (await api.get<Form>(`/work/public/forms/${uid}`)).data, retry: false });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: async () => (await api.post(`/work/public/forms/${uid}`, { answers })).data,
    onError: (e: any) => setError(e?.response?.status === 429 ? "Too many submissions — please wait a minute." : e?.response?.data?.message?.toString?.() ?? "Couldn't send. Try again."),
  });
  const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

  return (
    <div className="min-h-screen bg-[#f6f8f6] px-4 py-10 dark:bg-background">
      <div className="mx-auto max-w-[640px]">
        {isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-muted" /> : isError || !form ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center"><p className="text-[18px] font-semibold">This form is not open</p><p className="mt-1 text-[13.5px] text-muted-foreground">The link may be wrong, or the form was closed.</p></div>
        ) : submit.isSuccess ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-[20px] font-semibold">Thank you!</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Your answers were sent{form.company ? ` to ${form.company}` : ""}.</p>
            <button type="button" onClick={() => { setAnswers({}); submit.reset(); }} className="mt-5 text-[13px] font-medium text-primary hover:underline">Send another</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setError(null); submit.mutate(); }} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            {form.company && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{form.company}</p>}
            <h1 className="mt-1 text-[26px] font-semibold leading-tight">{form.name}</h1>
            {form.description && <p className="mt-2 whitespace-pre-wrap text-[14px] text-muted-foreground">{form.description}</p>}
            <div className="mt-6 space-y-5">
              {form.fields.map((f) => {
                const v = answers[f.id] ?? "";
                const set = (x: string) => setAnswers((a) => ({ ...a, [f.id]: x }));
                return (
                  <label key={f.id} className="block text-[13.5px] font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}
                    {f.type === "textarea" ? <textarea value={v} onChange={(e) => set(e.target.value)} rows={4} required={f.required} maxLength={10000} className={input} />
                      : f.type === "select" ? <select value={v} onChange={(e) => set(e.target.value)} required={f.required} className={input}><option value="">Choose…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      : <input type={f.type} value={v} onChange={(e) => set(e.target.value)} required={f.required} maxLength={1000} className={input} />}
                  </label>
                );
              })}
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>}
            <button type="submit" disabled={submit.isPending} className="mt-6 h-11 w-full rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground disabled:opacity-60">{submit.isPending ? "Sending…" : "Submit"}</button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Powered by EZ Manage</p>
          </form>
        )}
      </div>
    </div>
  );
}
