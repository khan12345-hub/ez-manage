"use client";

import { useState } from "react";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LIFECYCLE_LABEL, userName, type CrmUser, type Lifecycle } from "@/services/crm.api";

const TINTS = ["#047857", "#2563eb", "#b45309", "#be185d", "#7c3aed", "#0f766e", "#dc2626", "#4f46e5"];

export function Avatar({ user, name, size = 26, className }: { user?: Pick<CrmUser, "id" | "firstName" | "lastName" | "email" | "avatarUrl"> | null; name?: string; size?: number; className?: string }) {
  const label = user ? userName(user) : name ?? "";
  const initials = label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const tint = TINTS[((user?.id ?? label.length) % TINTS.length + TINTS.length) % TINTS.length];
  return (
    <span title={label} className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-white dark:ring-[#14181a]", className)} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38), background: tint }}>
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

/** company / contact logo tile from initials */
export function Monogram({ text, size = 34, className, tone }: { text: string; size?: number; className?: string; tone?: string }) {
  const t = tone ?? TINTS[(text.charCodeAt(0) || 0) % TINTS.length];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px] font-bold", className)} style={{ width: size, height: size, fontSize: size * 0.38, background: `${t}1a`, color: t }}>
      {text.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

const LC_TONE: Record<Lifecycle, string> = { subscriber: "#64748b", lead: "#2563eb", mql: "#7c3aed", sql: "#4f46e5", opportunity: "#b45309", customer: "#047857", evangelist: "#be185d", other: "#64748b" };
export function LifecyclePill({ value }: { value: Lifecycle }) {
  return <span className="ez-tint inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ ["--c" as any]: LC_TONE[value] ?? "#64748b" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: LC_TONE[value] }} />{LIFECYCLE_LABEL[value] ?? value}</span>;
}

export function StagePill({ stage }: { stage: { name: string; isWon?: boolean; isLost?: boolean; probability?: number } }) {
  const c = stage.isWon ? "#047857" : stage.isLost ? "#dc2626" : "#2563eb";
  return <span className="ez-tint inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ ["--c" as any]: c }}>{stage.name}{!stage.isWon && !stage.isLost && stage.probability !== undefined && <span className="font-normal opacity-70">· {stage.probability}%</span>}</span>;
}

/** pick a CRM member (owner / assignee); "none" allowed */
export function PersonPick({ members, value, onChange, label = "Owner", allowNone = true, disabled, compact }: { members: { user: CrmUser }[]; value: number | null; onChange: (id: number | null) => void; label?: string; allowNone?: boolean; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cur = members.find((m) => m.user.id === value)?.user ?? null;
  const shown = members.filter((m) => userName(m.user).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" aria-label={`${label}: ${cur ? userName(cur) : "nobody"}`} className={cn("flex min-w-0 items-center gap-1.5 rounded-lg text-left text-[13px] transition hover:bg-black/[0.04] disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-white/5", compact ? "px-1 py-0.5" : "h-9 w-full border border-border bg-background px-2.5")}>
          {cur ? <Avatar user={cur} size={20} /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground"><UserRound className="h-3 w-3" /></span>}
          <span className={cn("min-w-0 flex-1 truncate", !cur && "text-muted-foreground")}>{cur ? userName(cur) : compact ? "—" : `No ${label.toLowerCase()}`}</span>
          {!compact && !disabled && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-xl p-1.5">
        <label className="mb-1 flex h-8 items-center gap-1.5 rounded-lg border border-border px-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" /></label>
        <ul className="max-h-60 overflow-y-auto">
          {allowNone && <li><button type="button" onClick={() => { onChange(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent">Nobody{value === null && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</button></li>}
          {shown.map((m) => (
            <li key={m.user.id}><button type="button" onClick={() => { onChange(m.user.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Avatar user={m.user} size={22} /><span className="min-w-0 flex-1 truncate">{userName(m.user)}</span>{value === m.user.id && <Check className="h-3.5 w-3.5 text-primary" />}</button></li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function Empty({ icon: Icon, title, body, action }: { icon: typeof Search; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#be185d]/10 text-[#be185d] dark:bg-[#f472b6]/10 dark:text-[#f9a8d4]"><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.06]", className)} />;
}
