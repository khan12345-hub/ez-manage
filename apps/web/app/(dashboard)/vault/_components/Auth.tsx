"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { errMsg } from "../_lib/session";

export function PasswordInput({ value, onChange, label, autoFocus, autoComplete = "off" }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      <span className="mt-1 flex h-11 items-center rounded-lg border border-border bg-background pr-1 focus-within:border-primary/60">
        <input autoFocus={autoFocus} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} autoComplete={autoComplete} spellCheck={false} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none" />
        <button type="button" aria-label={show ? "Hide" : "Show"} onClick={() => setShow(!show)} className="rounded-md p-2 text-muted-foreground hover:bg-accent">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </span>
    </label>
  );
}

export function ResetVault({ onBack }: { onBack: () => void }) {
  const [acct, setAcct] = useState("");
  const [sure, setSure] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api.post("/vault/reset", { accountPassword: acct }); toast.success("EZ Vault was reset. Create a new master password."); window.location.reload(); }
    catch (e) { toast.error(errMsg(e, "Couldn't reset.")); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (sure === "RESET") void go(); }} className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-7 shadow-sm">
      <h1 className="font-serif text-[24px]">Forgot your master password?</h1>
      <p className="mt-2 text-[13.5px] text-muted-foreground">Nobody can open your vault without it — that&apos;s what keeps it safe. You can only <strong>reset EZ Vault</strong>: your personal items are deleted, you leave shared vaults (others keep them; ask an owner to add you back), and browser extensions are signed out.</p>
      <div className="mt-4 space-y-3">
        <PasswordInput label="Your EZ Manage account password" value={acct} onChange={setAcct} autoComplete="current-password" />
        <label className="block text-[12.5px] text-muted-foreground">Type <strong className="font-mono text-foreground">RESET</strong> to confirm
          <input value={sure} onChange={(e) => setSure(e.target.value)} aria-label="Type RESET to confirm" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-[14px] outline-none focus:border-destructive/60" />
        </label>
      </div>
      <div className="mt-5 flex justify-between">
        <button type="button" onClick={onBack} className="h-10 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Back</button>
        <button type="submit" disabled={busy || !acct || sure !== "RESET"} className={cn("h-10 rounded-lg bg-destructive px-4 text-[13px] font-semibold text-white disabled:opacity-50")}>{busy ? "Resetting…" : "Reset EZ Vault"}</button>
      </div>
    </form>
  );
}
