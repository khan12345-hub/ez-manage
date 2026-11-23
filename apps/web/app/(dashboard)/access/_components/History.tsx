"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Ban, CheckCircle2, LogIn, MailPlus, Power, PowerOff, ShieldCheck, ShieldMinus, UserMinus, UserPlus, XCircle } from "lucide-react";
import { accessApi, roleLabel, type AccessRow } from "@/services/access.api";
import { cn } from "@/lib/utils";
import { PRODUCT_META, when } from "./bits";

const ICON: Record<string, typeof UserPlus> = {
  invited: MailPlus, added: UserPlus, joined: LogIn, role_changed: ArrowRightLeft, removed: UserMinus, product_on: Power, product_off: PowerOff,
  disabled: Ban, enabled: CheckCircle2, refused: XCircle, promoted: ShieldCheck, demoted: ShieldMinus, manager_set: ShieldCheck, manager_removed: ShieldMinus,
};
const name = (p: AccessRow["actor"]) => (p ? `${p.firstName} ${p.lastName}`.trim() || p.email : null);

export function sentence(r: AccessRow) {
  const who = name(r.actor) ?? "Someone";
  const whom = name(r.target) ?? r.targetEmail ?? "someone";
  const product = r.product === "system" ? "EZ Manage" : PRODUCT_META[r.product as keyof typeof PRODUCT_META]?.label ?? r.product;
  const where = r.workspaceName ? ` · ${r.workspaceName}` : "";
  const as = r.toRole ? ` as ${roleLabel(r.toRole)}` : "";
  switch (r.action) {
    case "invited": return `${who} invited ${whom} to ${product}${where}${as}`;
    case "added": return `${who} added ${whom} to ${product}${where}${as}`;
    case "joined": return `${whom} joined ${product}${where}${as}`;
    case "role_changed": return `${who} changed ${whom}'s role in ${product}${where}: ${roleLabel(r.fromRole ?? "")} → ${roleLabel(r.toRole ?? "")}`;
    case "removed": return `${who} removed ${whom} from ${product}${where}`;
    case "product_on": return `${who} turned ${product} on for ${whom}`;
    case "product_off": return `${who} turned ${product} off for ${whom}`;
    case "disabled": return `${who} disabled ${whom}'s account`;
    case "enabled": return `${who} enabled ${whom}'s account`;
    case "refused": return `${who} tried to give ${whom} ${product}${where}, but it is off for them`;
    case "promoted": return `${who} made ${whom} a Co-Administrator`;
    case "demoted": return `${who} removed ${whom}'s Administrator role`;
    case "manager_set": return `${who} made ${whom} an Access Manager (${r.toRole ?? ""})`;
    case "manager_removed": return `${who} removed ${whom}'s Access Manager role`;
    default: return `${who} · ${r.action} · ${whom}`;
  }
}

export function HistoryList({ rows, compact }: { rows: AccessRow[]; compact?: boolean }) {
  if (!rows.length) return <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">Nothing yet.</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r) => {
        const Icon = ICON[r.action] ?? ArrowRightLeft;
        const color = r.product === "system" ? "#475569" : PRODUCT_META[r.product as keyof typeof PRODUCT_META]?.color ?? "#475569";
        const bad = ["removed", "product_off", "disabled", "refused", "demoted", "manager_removed"].includes(r.action);
        return (
          <li key={r.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: bad ? "#64748b" : color }}><Icon className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[13px] leading-snug", compact && "text-[12.5px]")}>{sentence(r)}</span>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{when(r.createdAt)}{r.via && r.via !== "product" ? ` · ${r.via.replace(/_/g, " ")}` : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryPage() {
  const [product, setProduct] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["access", "history", product, action, page], queryFn: () => accessApi.history({ product, action, page, pageSize: 50 }) });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section aria-label="Access history" className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[16px] font-semibold">Access history</h2>
        <select value={product} onChange={(e) => { setProduct(e.target.value); setPage(1); }} aria-label="Product" className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]">
          <option value="">All products</option>
          {Object.entries(PRODUCT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="system">Accounts &amp; roles (system)</option>
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="What happened" className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]">
          <option value="">Everything</option>
          {["invited", "added", "joined", "role_changed", "removed", "product_on", "product_off", "refused", "disabled", "enabled", "promoted", "demoted", "manager_set", "manager_removed"].map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {isLoading ? <div className="h-64 animate-pulse rounded-2xl bg-muted" /> : <HistoryList rows={data?.rows ?? []} />}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[12.5px]">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Previous</button>
          <span className="text-muted-foreground">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Next</button>
        </div>
      )}
      {data && <p className="mt-2 text-[11.5px] text-muted-foreground">{data.total} {data.total === 1 ? "event" : "events"}</p>}
    </section>
  );
}
