"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Loader2, MailPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { accessApi, roleLabel, type AccessCompanies, type InviteBody, type MyAccess } from "@/services/access.api";
import { PRODUCT_META, errText } from "./bits";

const sel = "h-9 rounded-xl border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50";

/** One place to invite people into several products: each product gets exactly the role picked here */
export function InvitePeople({ open, onClose, me, companies }: { open: boolean; onClose: () => void; me: MyAccess; companies?: AccessCompanies }) {
  const qc = useQueryClient();
  const [emails, setEmails] = useState("");
  const [acc, setAcc] = useState<{ on: boolean; ws: number | ""; role: string; boards: number[] }>({ on: false, ws: "", role: "MEMBER", boards: [] });
  const [work, setWork] = useState<{ on: boolean; ws: number | ""; role: string }>({ on: false, ws: "", role: "MEMBER" });
  const [tracker, setTracker] = useState<{ on: boolean; key: string; role: "member" | "admin" }>({ on: false, key: "", role: "member" });
  const [vault, setVault] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof accessApi.invite>>["results"] | null>(null);
  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const accWs = companies?.accounts.find((c) => c.id === acc.ws);
  const workWs = companies?.work.find((c) => c.id === work.ws);
  const send = useMutation({
    mutationFn: () => {
      const body: InviteBody = { emails: list };
      if (acc.on && acc.ws) body.accounts = { workspaceId: Number(acc.ws), role: acc.role, boardIds: acc.boards.length ? acc.boards : undefined };
      if (work.on && work.ws) body.work = { workspaceId: Number(work.ws), role: work.role };
      if (tracker.on && tracker.key) { const [source, id] = tracker.key.split(":"); body.tracker = { source: source as "boards" | "work", workspaceId: Number(id), role: tracker.role }; }
      if (vault) body.vault = true;
      return accessApi.invite(body);
    },
    onSuccess: (r) => { setResults(r.results); qc.invalidateQueries({ queryKey: ["access"] }); const ok = r.results.filter((x) => x.given.length).length; toast.success(`${ok} of ${r.results.length} invited`); },
    onError: (e) => toast.error(errText(e)),
  });
  const ready = list.length > 0 && ((acc.on && !!acc.ws) || (work.on && !!work.ws) || (tracker.on && !!tracker.key) || vault) && !(acc.on && !acc.ws) && !(work.on && !work.ws);
  const reset = () => { setEmails(""); setResults(null); setAcc({ on: false, ws: "", role: "MEMBER", boards: [] }); setWork({ on: false, ws: "", role: "MEMBER" }); setTracker({ on: false, key: "", role: "member" }); setVault(false); };

  const Block = ({ p, on, setOn, children, disabled, note }: { p: keyof typeof PRODUCT_META; on: boolean; setOn: (v: boolean) => void; children?: React.ReactNode; disabled?: boolean; note?: string }) => (
    <div className={cn("rounded-2xl border p-3 transition", on ? "border-primary/40 bg-primary/[0.03]" : "border-border", disabled && "opacity-60")}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4" />
        <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: PRODUCT_META[p].color }}>{PRODUCT_META[p].short.slice(0, 2)}</span>
        <span className="text-[13.5px] font-semibold">{PRODUCT_META[p].label}</span>
        {note && <span className="ml-auto text-[11.5px] text-muted-foreground">{note}</span>}
      </label>
      {on && children && <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">{children}</div>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5 text-primary" /> Invite people</DialogTitle>
        <DialogDescription>Pick the products and the role in each. They get exactly that — nothing in the other products. People who already have an account are added at once; new people get one email with everything.</DialogDescription>
        {results ? (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.email} className="rounded-xl border border-border p-3">
                <p className="text-[13.5px] font-semibold">{r.email} <span className="font-normal text-muted-foreground">· {r.existing ? "existing account" : "new — invitation sent"}</span></p>
                {r.given.map((g) => <p key={g} className="mt-1 flex items-start gap-1.5 text-[12.5px]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />{g}</p>)}
                {r.problems.map((g) => <p key={g} className="mt-1 flex items-start gap-1.5 text-[12.5px] text-[#b45309]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{g}</p>)}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={reset} className="h-9 rounded-xl border border-border px-3 text-[13px] font-medium hover:bg-accent">Invite more</button>
              <button type="button" onClick={() => { reset(); onClose(); }} className="h-9 rounded-xl bg-forest px-4 text-[13px] font-semibold text-white dark:bg-primary">Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[12.5px] font-medium">Emails
              <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="ali@company.com, sara@company.com" aria-label="Emails"
                className="mt-1 block w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary/50" />
              <span className="mt-1 block text-[11.5px] text-muted-foreground">{list.length ? `${list.length} ${list.length === 1 ? "person" : "people"}` : "Separate with commas or new lines (up to 50)."}</span>
            </label>
            <Block p="accounts" on={acc.on} setOn={(v) => setAcc((x) => ({ ...x, on: v }))} disabled={!companies?.accounts.length} note={!companies?.accounts.length ? "No companies you manage" : undefined}>
              <select value={acc.ws} onChange={(e) => setAcc((x) => ({ ...x, ws: e.target.value ? Number(e.target.value) : "", boards: [] }))} aria-label="Accounts company" className={cn(sel, "min-w-[180px] flex-1")}>
                <option value="">Company…</option>{companies?.accounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={acc.role} onChange={(e) => setAcc((x) => ({ ...x, role: e.target.value }))} aria-label="Accounts role" className={sel}>
                {["ADMIN", "MEMBER", "VIEWER", "GUEST"].filter((r) => r !== "ADMIN" || accWs?.mayGrantAdmin !== false).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              {accWs && accWs.boards.length > 0 && (
                <div className="w-full">
                  <p className="mb-1 text-[11.5px] text-muted-foreground">Boards {acc.boards.length ? `(${acc.boards.length})` : "(all)"}</p>
                  <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    {accWs.boards.map((b) => { const on = acc.boards.includes(b.id); return <button key={b.id} type="button" aria-pressed={on} onClick={() => setAcc((x) => ({ ...x, boards: on ? x.boards.filter((y) => y !== b.id) : [...x.boards, b.id] }))} className={cn("rounded-md px-2 py-0.5 text-[11.5px] ring-1", on ? "bg-primary/10 text-primary ring-primary/30" : "ring-border hover:bg-accent")}>{b.name}</button>; })}
                  </div>
                </div>
              )}
            </Block>
            <Block p="work" on={work.on} setOn={(v) => setWork((x) => ({ ...x, on: v }))} disabled={!companies?.work.length} note={!companies?.work.length ? "No companies you manage" : undefined}>
              <select value={work.ws} onChange={(e) => setWork((x) => ({ ...x, ws: e.target.value ? Number(e.target.value) : "" }))} aria-label="Company Work company" className={cn(sel, "min-w-[180px] flex-1")}>
                <option value="">Company…</option>{companies?.work.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={work.role} onChange={(e) => setWork((x) => ({ ...x, role: e.target.value }))} aria-label="Company Work role" className={sel}>
                {["ADMIN", "MEMBER", "LIMITED_MEMBER", "GUEST"].filter((r) => r !== "ADMIN" || workWs?.mayGrantAdmin !== false).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Block>
            {me.admin && (
              <Block p="tracker" on={tracker.on} setOn={(v) => setTracker((x) => ({ ...x, on: v }))} note="Existing accounts only">
                <select value={tracker.key} onChange={(e) => setTracker((x) => ({ ...x, key: e.target.value }))} aria-label="Tracker company" className={cn(sel, "min-w-[180px] flex-1")}>
                  <option value="">Company…</option>
                  <optgroup label="Accounts & Invoices">{companies?.tracker.boards.map((c) => <option key={`b${c.id}`} value={`boards:${c.id}`}>{c.name}</option>)}</optgroup>
                  <optgroup label="Company Work">{companies?.tracker.work.map((c) => <option key={`w${c.id}`} value={`work:${c.id}`}>{c.name}</option>)}</optgroup>
                </select>
                <select value={tracker.role} onChange={(e) => setTracker((x) => ({ ...x, role: e.target.value as "member" | "admin" }))} aria-label="Tracker role" className={sel}>
                  <option value="member">Tracked member</option><option value="admin">Tracker admin</option>
                </select>
              </Block>
            )}
            {me.admin && <Block p="vault" on={vault} setOn={setVault} note="Every account has its own vault" />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { reset(); onClose(); }} className="h-9 rounded-xl px-3 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Cancel</button>
              <button type="button" disabled={!ready || send.isPending} onClick={() => send.mutate()} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-4 text-[13px] font-semibold text-white disabled:opacity-40 dark:bg-primary">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />} Invite {list.length > 1 ? `${list.length} people` : ""}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
