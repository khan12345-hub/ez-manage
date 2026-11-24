"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Handshake, Loader2 } from "lucide-react";
import { AppSwitcher } from "@/components/AppSwitcher";
import { crmApi, fmtMoney } from "@/services/crm.api";
import { btnPrimary, errMsg, glass, input } from "./_lib/crm";

/** /crm: open the person's CRM, or start one (Administrators) */
export default function CrmLandingPage() {
  return <Suspense><CrmLanding /></Suspense>;
}

function CrmLanding() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const wantsNew = sp?.get("new") === "1";
  const { data, isLoading } = useQuery({ queryKey: ["crm", "workspaces"], queryFn: crmApi.workspaces });
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    if (!wantsNew && data?.workspaces.length === 1) router.replace(`/crm/${data.workspaces[0]!.uid}`);
  }, [data, wantsNew, router]);
  const create = useMutation({
    mutationFn: () => crmApi.createWorkspace({ name: name.trim(), currency }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["crm", "workspaces"] }); toast.success("Your CRM is ready"); router.push(`/crm/${r.uid}`); },
    onError: (e) => toast.error(errMsg(e, "Couldn't create the CRM.")),
  });

  return (
    <div className="relative flex min-h-full items-start justify-center bg-[#f1f4f2] px-4 py-10 dark:bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#34d399]/20 blur-[110px]" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-[#be185d]/12 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-[560px] space-y-4">
        <div className={`${glass} p-3`}><AppSwitcher active="crm" subtitle="Contacts, companies and deals" /></div>
        <div className={`${glass} p-6`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#be185d] text-white shadow-[0_10px_24px_-12px_rgba(190,24,93,0.9)]"><Handshake className="h-6 w-6" /></span>
          <h1 className="mt-4 text-[26px] font-semibold tracking-tight">EZ CRM</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Every contact, company and deal in one place: a pipeline you can drag, a timeline of every call and meeting, and tasks so nothing slips.</p>
          {isLoading ? <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <>
              {!!data?.workspaces.length && (
                <ul className="mt-5 space-y-2">
                  {data.workspaces.map((w) => (
                    <li key={w.uid}><Link href={`/crm/${w.uid}`} className="group flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3 transition hover:border-primary/40">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold">{w.name}</span><span className="block text-[12px] text-muted-foreground">{w.contacts} contacts · {w.openDeals} open deals · {fmtMoney(w.pipelineValue, w.currency, true)} pipeline</span></span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </Link></li>
                  ))}
                </ul>
              )}
              {data?.canCreate ? (
                <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="mt-6 space-y-3 border-t border-border pt-5">
                  <p className="text-[13px] font-semibold">{data.workspaces.length ? "Start another CRM" : "Start your CRM"}</p>
                  <div className="flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EZ Accounts sales" aria-label="CRM name" maxLength={80} className={input} />
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" className={`${input} w-28`}>{["USD", "CAD", "EUR", "GBP", "PKR", "AED", "INR"].map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <button type="submit" disabled={!name.trim() || create.isPending} className={btnPrimary}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Create CRM</button>
                  <p className="text-[11.5px] text-muted-foreground">It starts with a sales pipeline (New → Qualified → Meeting booked → Proposal → Negotiation → Won / Lost). You can change it in Settings.</p>
                </form>
              ) : !data?.workspaces.length && (
                <p className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3 text-[13px] text-muted-foreground dark:bg-white/5">You&apos;re not in a CRM yet. Ask an Administrator to add you.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
