"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import type { ProductKey } from "@/services/access.api";

export const PRODUCT_META: Record<ProductKey, { label: string; short: string; color: string }> = {
  accounts: { label: "Accounts & Invoices", short: "Accounts", color: "#4f46e5" },
  work: { label: "Company Work", short: "Work", color: "#047857" },
  tracker: { label: "EZ Tracker", short: "Tracker", color: "#0369a1" },
  vault: { label: "EZ Vault", short: "Vault", color: "#0f766e" },
  executive: { label: "Executive Hub", short: "Executive", color: "#b45309" },
};

export const errText = (e: any, fallback = "Something went wrong.") => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(" ") : typeof m === "string" ? m : fallback;
};

export function Person({ p, size = 32, sub, onDark }: { p: { firstName: string; lastName: string; email: string; avatarUrl: string | null }; size?: number; sub?: React.ReactNode; onDark?: boolean }) {
  const initials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || p.email[0]?.toUpperCase();
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold", onDark ? "bg-white/15 text-white ring-2 ring-white/25" : "bg-forest/10 text-forest dark:bg-white/10 dark:text-white")} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}>
        {p.avatarUrl ? <img src={resolveUrl(p.avatarUrl)} alt="" className="h-full w-full object-cover" /> : initials}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate font-semibold leading-tight", size > 40 ? "text-[17px]" : "text-[13.5px]")}>{`${p.firstName} ${p.lastName}`.trim() || p.email}</span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{sub ?? p.email}</span>
      </span>
    </span>
  );
}

export function RoleChip({ role, product }: { role: string; product: ProductKey }) {
  const admin = ["OWNER", "ADMIN", "admin"].includes(role);
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold", admin ? "text-white" : "bg-muted text-foreground/80")} style={admin ? { background: PRODUCT_META[product].color } : undefined}>
      {role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

/** a confirm that asks for the person's name when it matters */
export function Confirm({ open, title, body, action, danger, typeToConfirm, onConfirm, onClose, busy }: {
  open: boolean; title: string; body: React.ReactNode; action: string; danger?: boolean; typeToConfirm?: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const ok = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTyped(""); onClose(); } }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild><div className="text-[13.5px] leading-relaxed text-muted-foreground">{body}</div></DialogDescription>
        {typeToConfirm && (
          <label className="block text-[12.5px] text-muted-foreground">Type <b className="text-foreground">{typeToConfirm}</b> to confirm
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] text-foreground outline-none focus:border-primary/50" aria-label="Type the name to confirm" />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => { setTyped(""); onClose(); }} className="h-9 rounded-xl px-3 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Cancel</button>
          <button type="button" disabled={!ok || busy} onClick={() => { onConfirm(); setTyped(""); }}
            className={cn("h-9 rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-40", danger ? "bg-[#dc2626] hover:bg-[#b91c1c]" : "bg-forest hover:brightness-110 dark:bg-primary")}>{action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
