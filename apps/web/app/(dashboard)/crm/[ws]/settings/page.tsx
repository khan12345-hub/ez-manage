"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Mail, Plus, Trash2, Trophy, UserPlus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { crmApi, crmKeys, userName, type CrmObject, type CrmPropType, type CrmRole } from "@/services/crm.api";
import { btnGhost, btnPrimary, glass, input, onErr, useCrmWs } from "../../_lib/crm";
import { Avatar, Skeleton } from "../../_components/bits";

const TABS = [["general", "General"], ["members", "Members"], ["pipelines", "Pipelines"], ["properties", "Properties"]] as const;
type Tab = (typeof TABS)[number][0];
const ROLES: { value: CrmRole; label: string; hint: string }[] = [
  { value: "OWNER", label: "Owner", hint: "everything, incl. deleting the CRM" },
  { value: "ADMIN", label: "Admin", hint: "settings, members, pipelines" },
  { value: "MEMBER", label: "Member", hint: "create and edit records" },
  { value: "VIEWER", label: "Viewer", hint: "read only" },
];
type StageRow = { id?: number; name: string; probability: number; isWon?: boolean; isLost?: boolean; key: string };

export default function CrmSettingsPage() {
  const { uid, ws } = useCrmWs();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("general");
  const refresh = () => qc.invalidateQueries({ queryKey: crmKeys.ws(uid) });

  // general
  const [name, setName] = useState(""); const [currency, setCurrency] = useState("USD");
  useEffect(() => { if (ws) { setName(ws.name); setCurrency(ws.currency); } }, [ws]);
  const saveWs = useMutation({ mutationFn: () => crmApi.updateWorkspace(uid, { name: name.trim(), currency }), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["crm", "workspaces"] }); toast.success("Saved"); }, onError: onErr() });
  const delWs = useMutation({ mutationFn: () => crmApi.deleteWorkspace(uid), onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm"] }); router.push("/crm"); }, onError: onErr() });
  // members
  const [email, setEmail] = useState(""); const [role, setRole] = useState<CrmRole>("MEMBER");
  const addM = useMutation({ mutationFn: () => crmApi.addMember(uid, { email: email.trim(), role }), onSuccess: (r) => { const inv = (r as { invited?: boolean })?.invited; setEmail(""); refresh(); toast.success(inv ? "Invite sent — they join when they sign up" : "Added"); }, onError: onErr("Couldn't add.") });
  const roleM = useMutation({ mutationFn: (v: { id: number; role: CrmRole }) => crmApi.updateMember(uid, v.id, v.role), onSuccess: refresh, onError: onErr() });
  const rmM = useMutation({ mutationFn: (id: number) => crmApi.removeMember(uid, id), onSuccess: refresh, onError: onErr() });
  const cancelI = useMutation({ mutationFn: (id: number) => crmApi.cancelInvite(uid, id), onSuccess: () => { refresh(); toast.success("Invite cancelled"); }, onError: onErr() });
  // pipelines
  const [pid, setPid] = useState<number | null>(null);
  const pipeline = ws?.pipelines.find((p) => p.id === pid) ?? ws?.pipelines[0];
  const [pname, setPname] = useState("");
  const [rows, setRows] = useState<StageRow[]>([]);
  useEffect(() => { if (pipeline) { setPname(pipeline.name); setRows(pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, isWon: s.isWon, isLost: s.isLost, key: `s${s.id}` }))); } }, [pipeline]);
  const savePipe = useMutation({ mutationFn: () => crmApi.updatePipeline(uid, pipeline!.id, { name: pname.trim(), stages: rows.map(({ key: _k, ...r }) => r) }), onSuccess: () => { refresh(); toast.success("Pipeline saved"); }, onError: onErr("Couldn't save the pipeline.") });
  const newPipe = useMutation({ mutationFn: () => crmApi.createPipeline(uid, { name: "New pipeline" }), onSuccess: (list) => { refresh(); setPid(list.at(-1)?.id ?? null); }, onError: onErr() });
  const delPipe = useMutation({ mutationFn: () => crmApi.deletePipeline(uid, pipeline!.id), onSuccess: () => { setPid(null); refresh(); }, onError: onErr() });
  const moveRow = (i: number, d: -1 | 1) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const [dragI, setDragI] = useState<number | null>(null);
  // properties
  const [obj, setObj] = useState<CrmObject>("contact");
  const [plabel, setPlabel] = useState(""); const [ptype, setPtype] = useState<CrmPropType>("text"); const [popts, setPopts] = useState("");
  const addP = useMutation({ mutationFn: () => crmApi.createProperty(uid, { object: obj, label: plabel.trim(), type: ptype, options: popts.split(",").map((x) => x.trim()).filter(Boolean) }), onSuccess: () => { setPlabel(""); setPopts(""); refresh(); toast.success("Property added"); }, onError: onErr() });
  const delP = useMutation({ mutationFn: (id: number) => crmApi.deleteProperty(uid, id), onSuccess: refresh, onError: onErr() });

  if (!ws) return <Skeleton className="h-96" />;
  if (!ws.canAdmin) return <div className={cn(glass, "p-8 text-center text-[13px] text-muted-foreground")}>Only CRM owners and admins can change settings.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col">
        {TABS.map(([k, l]) => <button key={k} type="button" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} className={cn("shrink-0 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium", tab === k ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
      </nav>
      <section className={cn(glass, "min-w-0 p-5")}>
        {tab === "general" && (
          <div className="max-w-md space-y-4">
            <h2 className="text-[17px] font-semibold">General</h2>
            <label className="block text-[12.5px] font-medium text-muted-foreground">CRM name<input value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "mt-1")} /></label>
            <label className="block text-[12.5px] font-medium text-muted-foreground">Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)} className={cn(input, "mt-1")}>{["USD", "CAD", "EUR", "GBP", "PKR", "AED", "INR", "AUD"].map((c) => <option key={c}>{c}</option>)}</select></label>
            <button type="button" disabled={!name.trim() || saveWs.isPending} onClick={() => saveWs.mutate()} className={btnPrimary}>Save</button>
            {ws.role === "OWNER" && (
              <div className="mt-6 rounded-2xl border border-destructive/30 p-4">
                <p className="text-[13.5px] font-semibold text-destructive">Delete this CRM</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Removes every contact, company, deal and activity in it. This can&apos;t be undone.</p>
                <button type="button" onClick={() => window.prompt(`Type the CRM name (“${ws.name}”) to delete it`) === ws.name && delWs.mutate()} className={cn(btnGhost, "mt-3 text-destructive")}><Trash2 className="h-3.5 w-3.5" /> Delete CRM</button>
              </div>
            )}
          </div>
        )}

        {tab === "members" && (
          <div className="space-y-4">
            <h2 className="text-[17px] font-semibold">Members <span className="text-muted-foreground">{ws.members.length}</span></h2>
            <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) addM.mutate(); }} className="flex flex-wrap gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email — existing user joins now, a new one gets an invite" aria-label="Email" className={cn(input, "min-w-[220px] flex-1")} />
              <select value={role} onChange={(e) => setRole(e.target.value as CrmRole)} aria-label="Role" className={cn(input, "w-36")}>{ROLES.filter((r) => ws.role === "OWNER" || r.value !== "OWNER").map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
              <button type="submit" disabled={!email.trim() || addM.isPending} className={btnPrimary}><UserPlus className="h-4 w-4" /> Add</button>
            </form>
            <p className="text-[12px] text-muted-foreground">{ROLES.map((r) => `${r.label}: ${r.hint}`).join(" · ")}</p>
            <ul className="divide-y divide-border/60 rounded-2xl border border-border">
              {ws.members.map((m) => (
                <li key={m.user.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <Avatar user={m.user} size={32} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{userName(m.user)}{m.user.id === user?.id && <span className="text-muted-foreground"> (you)</span>}</span><span className="block truncate text-[12px] text-muted-foreground">{m.user.email}</span></span>
                  <select aria-label={`Role of ${userName(m.user)}`} value={m.role} disabled={m.user.id === user?.id} onChange={(e) => roleM.mutate({ id: m.user.id, role: e.target.value as CrmRole })} className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px]">{ROLES.filter((r) => ws.role === "OWNER" || r.value !== "OWNER" || m.role === "OWNER").map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                  {m.user.id !== user?.id && <button type="button" aria-label={`Remove ${userName(m.user)}`} onClick={() => window.confirm(`Remove ${userName(m.user)} from this CRM? Their records stay, without an owner.`) && rmM.mutate(m.user.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
            {!!ws.invites?.length && (
              <div className="space-y-2">
                <h3 className="text-[13px] font-semibold text-muted-foreground">Pending invites <span>{ws.invites.length}</span></h3>
                <ul className="divide-y divide-border/60 rounded-2xl border border-dashed border-border">
                  {ws.invites.map((iv) => (
                    <li key={iv.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"><Mail className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{iv.email}</span><span className="block truncate text-[12px] text-muted-foreground">Invited as {ROLES.find((r) => r.value === iv.role)?.label ?? iv.role} · not signed up yet</span></span>
                      <button type="button" aria-label={`Cancel invite to ${iv.email}`} onClick={() => cancelI.mutate(iv.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "pipelines" && pipeline && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold">Pipelines</h2>
              <span className="flex-1" />
              {ws.pipelines.length > 1 && <select aria-label="Pipeline" value={pipeline.id} onChange={(e) => setPid(Number(e.target.value))} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]">{ws.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
              <button type="button" onClick={() => newPipe.mutate()} className={btnGhost}><Plus className="h-3.5 w-3.5" /> New pipeline</button>
            </div>
            <label className="block max-w-sm text-[12.5px] font-medium text-muted-foreground">Name<input value={pname} onChange={(e) => setPname(e.target.value)} className={cn(input, "mt-1")} /></label>
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">Stages: drag to reorder; the % is the chance to win, used for the weighted forecast.</p>
              <ul className="space-y-1.5">
                {rows.map((r, i) => (
                  <li key={r.key} draggable onDragStart={() => setDragI(i)} onDragOver={(e) => { e.preventDefault(); if (dragI !== null && dragI !== i) { setRows((x) => { const n = [...x]; const [m] = n.splice(dragI, 1); n.splice(i, 0, m!); return n; }); setDragI(i); } }} onDragEnd={() => setDragI(null)}
                    className={cn("flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5", dragI === i && "opacity-50")}>
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    {r.isWon ? <Trophy className="h-4 w-4 shrink-0 text-[#047857]" /> : r.isLost ? <XCircle className="h-4 w-4 shrink-0 text-[#dc2626]" /> : <span className="w-4" />}
                    <input value={r.name} onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, name: e.target.value } : y)))} aria-label="Stage name" className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[13.5px] outline-none focus:bg-card focus:ring-1 focus:ring-primary/30" />
                    <label className="flex items-center gap-1 text-[12px] text-muted-foreground"><input type="number" min={0} max={100} value={r.probability} disabled={r.isWon || r.isLost} onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, probability: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : y)))} aria-label={`${r.name} chance to win`} className="h-8 w-14 rounded-lg border border-border bg-card px-1.5 text-right text-foreground" />%</label>
                    <button type="button" aria-label="Move up" onClick={() => moveRow(i, -1)} className="rounded p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" onClick={() => moveRow(i, 1)} className="rounded p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                    {!r.isWon && !r.isLost ? <button type="button" aria-label={`Remove ${r.name}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button> : <span className="w-[22px]" />}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setRows((x) => { const at = x.findIndex((y) => y.isWon || y.isLost); const n = [...x]; n.splice(at < 0 ? n.length : at, 0, { name: "New stage", probability: 50, key: `n${Date.now()}` }); return n; })} className={cn(btnGhost, "mt-2")}><Plus className="h-3.5 w-3.5" /> Add stage</button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="button" disabled={!pname.trim() || rows.some((r) => !r.name.trim()) || savePipe.isPending} onClick={() => savePipe.mutate()} className={btnPrimary}>Save pipeline</button>
              {ws.pipelines.length > 1 && <button type="button" onClick={() => window.confirm(`Delete “${pipeline.name}”? It must have no deals.`) && delPipe.mutate()} className={cn(btnGhost, "text-destructive")}><Trash2 className="h-3.5 w-3.5" /> Delete pipeline</button>}
            </div>
          </div>
        )}

        {tab === "properties" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold">Custom properties</h2>
              <span className="flex-1" />
              <div role="group" aria-label="Object" className="flex rounded-xl border border-border bg-card p-0.5">{(["contact", "company", "deal"] as const).map((o) => <button key={o} type="button" aria-pressed={obj === o} onClick={() => setObj(o)} className={cn("rounded-lg px-3 py-1 text-[12.5px] font-medium capitalize", obj === o ? "bg-accent" : "text-muted-foreground")}>{o === "company" ? "Companies" : `${o}s`}</button>)}</div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (plabel.trim()) addP.mutate(); }} className="flex flex-wrap gap-2">
              <input value={plabel} onChange={(e) => setPlabel(e.target.value)} placeholder="Label, e.g. Annual revenue" aria-label="Property label" className={cn(input, "min-w-[200px] flex-1")} />
              <select value={ptype} onChange={(e) => setPtype(e.target.value as CrmPropType)} aria-label="Type" className={cn(input, "w-40")}>{[["text", "Text"], ["number", "Number"], ["date", "Date"], ["select", "Dropdown"], ["multiselect", "Multiple choice"], ["bool", "Yes / No"], ["url", "Link"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              {(ptype === "select" || ptype === "multiselect") && <input value={popts} onChange={(e) => setPopts(e.target.value)} placeholder="Options, comma separated" aria-label="Options" className={cn(input, "min-w-[200px] flex-1")} />}
              <button type="submit" disabled={!plabel.trim() || addP.isPending} className={btnPrimary}><Plus className="h-4 w-4" /> Add</button>
            </form>
            {!ws.properties.filter((p) => p.object === obj).length ? <p className="py-6 text-center text-[13px] text-muted-foreground">No custom properties yet. They show on the record, as table columns and in filters.</p> : (
              <ul className="divide-y divide-border/60 rounded-2xl border border-border">
                {ws.properties.filter((p) => p.object === obj).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">{p.label}</span><span className="block truncate text-[12px] text-muted-foreground">{p.type}{p.options.length ? ` · ${p.options.join(", ")}` : ""} · key <code>{p.key}</code></span></span>
                    <button type="button" aria-label={`Delete ${p.label}`} onClick={() => window.confirm(`Delete the property “${p.label}”? Values saved on records stay hidden.`) && delP.mutate(p.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
