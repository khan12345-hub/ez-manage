"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { AppSwitcher } from "@/components/AppSwitcher";
import { errMsg, lockMinutes, useVault, vaultApi } from "./_lib/session";
import { VaultMain } from "./_components/VaultMain";
import { StrengthBar } from "./_components/bits";
import { PasswordInput, ResetVault } from "./_components/Auth";
import { RecoveryFlow } from "./_components/Recovery";

/** EZ Vault: set up a master password, unlock, then the vault. */
export default function VaultPage() {
  const { data: me, isLoading, isError, refetch } = useQuery({ queryKey: ["vault", "me"], queryFn: vaultApi.me, refetchOnWindowFocus: false });
  const { unlocked, setMe, lock } = useVault();
  useEffect(() => { if (me) setMe(me); }, [me, setMe]);

  // lock after a while without activity, and never keep it open across a reload
  const last = useRef(Date.now());
  useEffect(() => {
    if (!unlocked) return;
    const bump = () => { last.current = Date.now(); };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last.current > lockMinutes() * 60_000) { lock(); toast("EZ Vault locked"); } }, 15_000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [unlocked, lock]);
  useEffect(() => () => lock(), [lock]);

  if (isError) return <Centered><p className="text-[14px] text-muted-foreground">Couldn&apos;t open EZ Vault. Sign in again.</p></Centered>;
  if (isLoading || !me) return <Centered><div className="h-40 w-80 animate-pulse rounded-2xl bg-muted" /></Centered>;
  if (!me.setup) return <Setup onDone={() => refetch()} />;
  if (!unlocked) return <Unlock name={me.user.firstName} recovery={!!me.recovery?.covered} pending={!!me.recoveryRequest} />;
  return <VaultMain />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-2.5">
        <div className="w-[240px] max-w-full"><AppSwitcher active="vault" subtitle="Password manager" /></div>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">{children}</div>
    </div>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const me = useVault((s) => s.me);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [example] = useState(() => C.generatePassphrase({ words: 4 }));
  const s = C.strength(pw);
  const ok = pw.length >= 10 && s >= 2 && pw === pw2 && ack;
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const k = await C.createUserKeys(pw);
      const vk = await C.newVaultKey();
      const rec = me?.recovery;
      const recovery = rec?.enabled && rec.publicKey ? { ...(await C.wrapForRecovery(k.pkcs8, rec.publicKey)), version: rec.version } : undefined;
      await api.post("/vault/setup", { ...k.stored, personal: { encName: await C.encryptText(vk, "Personal"), encVaultKey: await C.wrapVaultKey(vk, k.publicKey) }, ...(recovery ? { recovery } : {}) });
      useVault.getState().setMe({ ...(useVault.getState().me as any), setup: true, keys: k.stored });
      await useVault.getState().open(k.privateKey);
      toast.success("EZ Vault is ready");
      onDone();
    } catch (e) { toast.error(errMsg(e, "Couldn't set up EZ Vault.")); } finally { setBusy(false); }
  };
  return (
    <Centered>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-product-vault/12 text-product-vault ring-1 ring-product-vault/25"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="mt-4 font-serif text-[28px] leading-tight">Create your master password</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">It locks everything in your vault. It is never sent to our server, so nobody — not even an admin — can open your passwords.</p>
        <div className="mt-5 space-y-3">
          <PasswordInput label="Master password" value={pw} onChange={setPw} autoFocus autoComplete="new-password" />
          <StrengthBar value={pw ? s : -1} />
          <PasswordInput label="Type it again" value={pw2} onChange={setPw2} autoComplete="new-password" />
          {pw2 && pw !== pw2 && <p className="text-[12px] text-destructive">The two don&apos;t match.</p>}
          <p className="text-[12px] text-muted-foreground">Use at least 10 characters. A few random words work well, e.g. <span className="font-mono">{example}</span></p>
          <label className="flex items-start gap-2 rounded-lg border border-[#b45309]/30 bg-[#b45309]/5 p-3 text-[12.5px]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            {me?.recovery?.enabled
              ? <span>I understand: <strong>my master password is never sent to EZ Manage.</strong> If I forget it, the Administrator can help me set a new one (they still can&apos;t read my passwords).</span>
              : <span>I understand: <strong>if I forget my master password, my saved passwords can&apos;t be recovered.</strong> I can only reset EZ Vault and start empty.</span>}
          </label>
        </div>
        <button type="submit" disabled={!ok || busy} className="mt-5 h-11 w-full rounded-lg bg-forest text-[14px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{busy ? "Setting up…" : "Create my vault"}</button>
      </form>
    </Centered>
  );
}

function Unlock({ name, recovery, pending }: { name: string; recovery: boolean; pending: boolean }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(pending);
  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true); setErr("");
    try { await useVault.getState().unlock(pw); } catch (e) { setErr(errMsg(e, "Couldn't unlock.")); } finally { setBusy(false); setPw(""); }
  };
  return (
    <Centered>
      {forgot ? (recovery || pending ? <RecoveryFlow onBack={() => setForgot(false)} /> : <ResetVault onBack={() => setForgot(false)} />) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-product-vault/12 text-product-vault ring-1 ring-product-vault/25"><Lock className="h-6 w-6" /></span>
          <h1 className="mt-4 font-serif text-[26px]">Welcome back, {name}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Enter your master password to unlock EZ Vault.</p>
          <div className="mt-5 text-left"><PasswordInput label="Master password" value={pw} onChange={setPw} autoFocus autoComplete="current-password" /></div>
          {err && <p role="alert" className="mt-2 text-left text-[12.5px] text-destructive">{err}</p>}
          <button type="submit" disabled={!pw || busy} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest text-[14px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><KeyRound className="h-4 w-4" />{busy ? "Unlocking…" : "Unlock"}</button>
          <button type="button" onClick={() => setForgot(true)} className="mt-3 text-[12.5px] text-muted-foreground hover:text-foreground">Forgot master password?</button>
        </form>
      )}
    </Centered>
  );
}
