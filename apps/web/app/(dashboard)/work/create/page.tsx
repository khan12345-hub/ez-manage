"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { workApi } from "@/services/work.api";
import { SPACE_COLORS } from "../_components/SpaceIcon";

const USES = ["Work", "Personal", "School", "Marketing", "Agency", "Software development", "Operations", "Sales & CRM", "HR & Recruiting", "Other"];
const SIZES = ["Just me", "2-5", "6-10", "11-25", "26-50", "51-200", "201-500", "500+"];
const STEPS = ["name", "use", "size", "invite"] as const;

/** Create a Work workspace (ClickUp onboarding): name & colour → use → team size → invite. */
export default function CreateWorkWorkspacePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[6]!);
  const [use, setUse] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = STEPS[step]!;
  const canNext = cur === "name" ? !!name.trim() : cur === "use" ? !!use : cur === "size" ? !!size : true;

  const addEmail = () => {
    const list = draft.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const bad = list.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad.length) return toast.error(`Not a valid email: ${bad.join(", ")}`);
    setEmails([...new Set([...emails, ...list])]);
    setDraft("");
  };
  const finish = async () => {
    setBusy(true);
    try {
      const ws = await workApi.createWorkspace({ name: name.trim(), color, useCase: use ?? undefined, teamSize: size ?? undefined, inviteEmails: emails });
      await qc.invalidateQueries({ queryKey: ["work", "my-workspaces"] });
      toast.success(`Workspace “${ws.name}” is ready`);
      router.push(`/work/${ws.uid}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create the workspace.");
      setBusy(false);
    }
  };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <div className="flex min-h-full w-full items-start justify-center bg-muted/20 px-4 py-10 sm:py-16">
      <div className="w-full max-w-[640px]">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/work" className="flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Work</Link>
          <span className="flex-1" />
          <span className="font-mono text-[11px] text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mb-8 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => <span key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />)}
        </div>

        <section aria-label="Create a Workspace" className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {cur === "name" && (
            <>
              <h1 className="text-[24px] font-semibold">Name your Workspace</h1>
              <p className="mt-1 text-[13.5px] text-muted-foreground">A Work workspace is separate from Boards — its own spaces, tasks, people and roles.</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[24px] font-bold text-white" style={{ background: color }}>{(name.trim() || "W")[0]!.toUpperCase()}</span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && canNext && next()} maxLength={80} placeholder="e.g. Bogo Solutions" aria-label="Workspace name" className="h-12 flex-1 rounded-lg border border-border bg-background px-3.5 text-[15px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
              </div>
              <div role="radiogroup" aria-label="Workspace colour" className="mt-4 flex flex-wrap gap-2">
                {SPACE_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: c }}>
                    {color === c && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </>
          )}
          {cur === "use" && (
            <>
              <h1 className="text-[24px] font-semibold">What will you use this Workspace for?</h1>
              <div role="radiogroup" aria-label="Use" className="mt-6 flex flex-wrap gap-2">
                {USES.map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={use === u} onClick={() => setUse(u)} className={cn("rounded-full border px-4 py-2 text-[13.5px]", use === u ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent")}>{u}</button>
                ))}
              </div>
            </>
          )}
          {cur === "size" && (
            <>
              <h1 className="text-[24px] font-semibold">How many people will you work with?</h1>
              <div role="radiogroup" aria-label="Team size" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SIZES.map((x) => (
                  <button key={x} type="button" role="radio" aria-checked={size === x} onClick={() => setSize(x)} className={cn("rounded-lg border px-3 py-2.5 text-[13.5px]", size === x ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent")}>{x}</button>
                ))}
              </div>
            </>
          )}
          {cur === "invite" && (
            <>
              <h1 className="text-[24px] font-semibold">Invite people to your Workspace</h1>
              <p className="mt-1 text-[13.5px] text-muted-foreground">They&apos;ll get Work access only. You can also do this later.</p>
              <div className="mt-6 flex gap-2">
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (draft.trim()) addEmail(); } }} placeholder="Enter email addresses" aria-label="Invite emails" className="h-11 flex-1 rounded-lg border border-border bg-background px-3.5 text-[14px] outline-none focus:border-primary/50" />
                <button type="button" onClick={addEmail} disabled={!draft.trim()} className="h-11 rounded-lg border border-border px-4 text-[13px] font-medium hover:bg-accent disabled:opacity-50">Add</button>
              </div>
              {emails.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {emails.map((e) => (
                    <li key={e} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12.5px]">
                      {e}
                      <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="mt-8 flex items-center gap-2">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="h-10 rounded-lg px-4 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">Back</button>}
            <span className="flex-1" />
            {cur === "invite" && emails.length === 0 && <span className="mr-2 text-[12px] text-muted-foreground">You can skip this</span>}
            <button type="button" disabled={!canNext || busy} onClick={next} className="h-10 rounded-lg bg-forest px-5 text-[13.5px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
              {busy ? "Creating…" : cur === "invite" ? "Finish" : "Next"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
