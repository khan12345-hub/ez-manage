"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, CreditCard, FileText, Fingerprint, Globe, IdCard, RefreshCw, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { vaultApi, type Item, type ItemType } from "../_lib/session";

const STRENGTH = [
  { label: "Very weak", color: "#dc2626" },
  { label: "Weak", color: "#ea580c" },
  { label: "Fair", color: "#ca8a04" },
  { label: "Strong", color: "#16a34a" },
  { label: "Very strong", color: "#0f766e" },
];
export function StrengthBar({ value }: { value: number }) {
  return (
    <div aria-label={value >= 0 ? `Strength: ${STRENGTH[value]!.label}` : "Strength"}>
      <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full bg-muted" style={value >= i ? { background: STRENGTH[value]!.color } : undefined} />)}</div>
      {value >= 0 && <p className="mt-1 text-[11.5px] font-medium" style={{ color: STRENGTH[value]!.color }}>{STRENGTH[value]!.label}</p>}
    </div>
  );
}
export const strengthMeta = (v: number) => STRENGTH[v]!;

/** copy a secret; clears the clipboard after 60 s if it still holds it */
export async function copySecret(text: string, what: string, item?: Item, field?: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
    if (item) void vaultApi.event(item.uid, "copied", field);
    setTimeout(async () => { try { if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText(""); } catch { /* no read permission */ } }, 60_000);
  } catch { toast.error("Couldn't copy."); }
}

export function CopyButton({ text, what, item, field, className }: { text: string; what: string; item?: Item; field?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${what.toLowerCase()}`} title={`Copy ${what.toLowerCase()}`} onClick={() => { void copySecret(text, what, item, field); setDone(true); setTimeout(() => setDone(false), 1200); }} className={cn("rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground", className)}>
      {done ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

const TYPE_ICON: Record<ItemType, typeof Globe> = { login: Globe, passkey: Fingerprint, note: FileText, card: CreditCard, identity: IdCard };
/**
 * A login shows the website's own icon, fetched straight from that site (e.g. facebook.com/favicon.ico) —
 * never through a third-party favicon service, so no one else learns which sites you keep logins for.
 * When a site has no reachable icon we fall back to its initial on a colored tile.
 */
export function ItemIcon({ item, size = 34 }: { item: Item; size?: number }) {
  const d = item.data;
  const host = d.urls?.[0] ? C.hostOf(d.urls[0]) : "";
  const letter = (host || d.title || "?").replace(/^www\./, "").charAt(0).toUpperCase();
  let h = 0;
  for (const ch of host || d.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const Icon = TYPE_ICON[d.type] ?? Globe;
  const [broken, setBroken] = useState(false);
  // a new item (host changes) should try its favicon again
  useEffect(() => setBroken(false), [host]);
  const showIcon = d.type === "login" && !!host && !broken;

  if (showIcon) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.06] dark:bg-white/90" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://${host}/favicon.ico`}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          style={{ width: size * 0.62, height: size * 0.62, objectFit: "contain" }}
        />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-white" style={{ width: size, height: size, background: `hsl(${h % 360} 45% 38%)`, fontSize: size * 0.42 }}>
      {d.type === "login" && letter ? <span className="font-semibold">{letter}</span> : <Icon style={{ width: size * 0.5, height: size * 0.5 }} />}
    </span>
  );
}

/** password generator in a popover */
export function Generator({ onUse }: { onUse: (pw: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"random" | "words">("random");
  const [len, setLen] = useState(20);
  const [words, setWords] = useState(4);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [pw, setPw] = useState("");
  const make = () => setPw(mode === "random" ? C.generatePassword({ length: len, digits, symbols }) : C.generatePassphrase({ words }));
  useEffect(() => { if (open) make(); }, [open, mode, len, words, digits, symbols]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Generate a password" title="Generate a password" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Wand2 className="h-4 w-4" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-[12px]">
          {(["random", "words"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("flex-1 rounded-md py-1 font-medium", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>{m === "random" ? "Random" : "Words"}</button>)}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
          <span className="min-w-0 flex-1 break-all font-mono text-[13px]">{pw}</span>
          <button type="button" aria-label="New password" onClick={make} className="rounded p-1 text-muted-foreground hover:bg-accent"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-2"><StrengthBar value={C.strength(pw)} /></div>
        {mode === "random" ? (
          <div className="mt-3 space-y-2 text-[12.5px]">
            <label className="flex items-center gap-2">Length <input type="range" min={8} max={64} value={len} onChange={(e) => setLen(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" aria-label="Length" /><span className="w-6 text-right font-mono">{len}</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} className="accent-[var(--primary)]" /> Numbers</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} className="accent-[var(--primary)]" /> Symbols</label>
          </div>
        ) : (
          <label className="mt-3 flex items-center gap-2 text-[12.5px]">Words <input type="range" min={3} max={8} value={words} onChange={(e) => setWords(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" aria-label="Words" /><span className="w-6 text-right font-mono">{words}</span></label>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => copySecret(pw, "Password")} className="h-8 rounded-md border border-border px-2.5 text-[12.5px] hover:bg-accent">Copy</button>
          <button type="button" onClick={() => { onUse(pw); setOpen(false); }} className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground">Use password</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** live one-time code with a countdown ring */
export function TotpCode({ secret, item }: { secret: string; item?: Item }) {
  const [t, setT] = useState<{ code: string; left: number; period: number } | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let alive = true;
    const tick = () => C.totp(secret).then((r) => { if (alive) { setT(r); setBad(false); } }).catch(() => alive && setBad(true));
    void tick();
    const i = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(i); };
  }, [secret]);
  if (bad) return <span className="text-[12.5px] text-destructive">Not a valid one-time code secret</span>;
  if (!t) return <span className="text-muted-foreground">…</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[18px] tracking-[0.15em]">{t.code.slice(0, 3)} {t.code.slice(3)}</span>
      <svg width="18" height="18" viewBox="0 0 20 20" aria-label={`${t.left} seconds left`}><circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2.5" /><circle cx="10" cy="10" r="8" fill="none" stroke={t.left <= 5 ? "#dc2626" : "var(--primary)"} strokeWidth="2.5" strokeDasharray={`${(t.left / t.period) * 50.3} 50.3`} transform="rotate(-90 10 10)" /></svg>
      <CopyButton text={t.code} what="One-time code" item={item} field="totp" />
    </span>
  );
}

export const ago = (iso: string) => {
  const s = Math.round((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
