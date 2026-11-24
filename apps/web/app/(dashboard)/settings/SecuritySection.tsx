"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Smartphone, Mail, KeyRound, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import {
  mfaGetStatus, mfaBeginTotp, mfaConfirmTotp, mfaEnableEmail, mfaDisable, mfaRegenerateRecovery,
  type MfaStatus,
} from "@/services/auth/auth.api";
import { cn } from "@/lib/utils";

export function SecuritySection() {
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery({ queryKey: ["mfa", "status"], queryFn: mfaGetStatus });
  const [recovery, setRecovery] = useState<string[] | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["mfa", "status"] }); qc.invalidateQueries({ queryKey: ["me"] }); };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4.5 w-4.5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">Two-step verification</h2>
          <p className="text-[13px] text-muted-foreground">Add a second step at sign-in so a stolen password isn't enough.</p>
        </div>
        {s && (
          <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold", s.enabled ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : s.required ? "bg-amber-500/12 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
            {s.enabled ? "On" : s.required ? "Required" : "Off"}
          </span>
        )}
      </div>

      {s?.required && !s.enabled && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Two-step verification is required for your account (Administrator or EZ Vault). Set up at least one method below.
        </p>
      )}

      {isLoading || !s ? <div className="mt-5 h-40 animate-pulse rounded-xl bg-muted" /> : (
        <div className="mt-5 space-y-3">
          <TotpRow s={s} onChanged={refresh} onRecovery={setRecovery} />
          <EmailRow s={s} onChanged={refresh} onRecovery={setRecovery} />
          <RecoveryRow s={s} onRecovery={setRecovery} />
        </div>
      )}

      {recovery && <RecoveryCodes codes={recovery} onClose={() => setRecovery(null)} />}
    </section>
  );
}

function Row({ icon: Icon, title, sub, children }: { icon: React.ElementType; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium text-foreground">{title}</p><p className="text-[12px] text-muted-foreground">{sub}</p></div>
      {children}
    </div>
  );
}

function TotpRow({ s, onChanged, onRecovery }: { s: MfaStatus; onChanged: () => void; onRecovery: (c: string[]) => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const begin = useMutation({ mutationFn: mfaBeginTotp, onSuccess: (d) => setSetup(d), onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't start setup.") });
  const confirm = useMutation({ mutationFn: () => mfaConfirmTotp(code), onSuccess: (d) => { setSetup(null); setCode(""); onChanged(); onRecovery(d.recoveryCodes); toast.success("Authenticator app turned on."); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Wrong code.") });
  const remove = useMutation({ mutationFn: () => mfaDisable("totp"), onSuccess: () => { onChanged(); toast.success("Authenticator removed."); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't remove.") });

  return (
    <div>
      <Row icon={Smartphone} title="Authenticator app" sub={s.totp ? "On — codes from your app" : "Google Authenticator, 1Password, Authy…"}>
        {s.totp
          ? <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50">Remove</button>
          : <button type="button" onClick={() => begin.mutate()} disabled={begin.isPending} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-white dark:bg-primary disabled:opacity-50">{begin.isPending ? "…" : "Set up"}</button>}
      </Row>
      {setup && (
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3.5">
          <p className="text-[12.5px] text-muted-foreground">In your authenticator app, choose <b>Add → Enter a setup key</b> and paste this key:</p>
          <CopyField value={setup.secret} mono />
          <p className="mt-3 text-[12.5px] text-muted-foreground">Then enter the 6-digit code it shows:</p>
          <div className="mt-1.5 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className="h-9 w-32 rounded-lg border border-border bg-background px-3 text-[14px] tracking-[0.2em] outline-none focus:border-primary/50" />
            <button type="button" onClick={() => confirm.mutate()} disabled={confirm.isPending || code.trim().length < 6} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-white dark:bg-primary disabled:opacity-50">{confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}</button>
            <button type="button" onClick={() => { setSetup(null); setCode(""); }} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailRow({ s, onChanged, onRecovery }: { s: MfaStatus; onChanged: () => void; onRecovery: (c: string[]) => void }) {
  const enable = useMutation({ mutationFn: mfaEnableEmail, onSuccess: (d) => { onChanged(); if (d.recoveryCodes) onRecovery(d.recoveryCodes); toast.success("Email codes turned on."); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't turn on.") });
  const remove = useMutation({ mutationFn: () => mfaDisable("email"), onSuccess: () => { onChanged(); toast.success("Email codes turned off."); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't turn off.") });
  return (
    <Row icon={Mail} title="Email code" sub={s.email ? "On — a code is emailed at sign-in" : "A 6-digit code sent to your email"}>
      {s.email
        ? <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50">Turn off</button>
        : <button type="button" onClick={() => enable.mutate()} disabled={enable.isPending} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-white dark:bg-primary disabled:opacity-50">Turn on</button>}
    </Row>
  );
}

function RecoveryRow({ s, onRecovery }: { s: MfaStatus; onRecovery: (c: string[]) => void }) {
  const regen = useMutation({ mutationFn: mfaRegenerateRecovery, onSuccess: (d) => { onRecovery(d.recoveryCodes); toast.success("New recovery codes generated."); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't generate.") });
  if (!s.enabled) return null;
  return (
    <Row icon={KeyRound} title="Recovery codes" sub={`${s.recoveryLeft} unused · use one if you lose your phone or email`}>
      <button type="button" onClick={() => regen.mutate()} disabled={regen.isPending} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50">Regenerate</button>
    </Row>
  );
}

function CopyField({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className={cn("min-w-0 flex-1 truncate text-[13px]", mono && "font-mono tracking-[0.1em]")}>{value}</span>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function RecoveryCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><h3 className="text-[15px] font-semibold">Save your recovery codes</h3></div>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Each code works once if you can't use your app or email. Keep them somewhere safe — they won't be shown again.</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/30 p-3 font-mono text-[13px]">
          {codes.map((c) => <span key={c} className="tracking-[0.08em]">{c}</span>)}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(codes.join("\n")); toast.success("Copied"); }} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent">Copy all</button>
          <button type="button" onClick={onClose} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-white dark:bg-primary">Done</button>
        </div>
      </div>
    </div>
  );
}
