"use client";

/*
 * Forgot master password, with the Administrator's help (admin recovery, option B):
 * 1. ask (account password; a one-time key is made in THIS browser and kept in it),
 * 2. wait for the Administrator to approve,
 * 3. set a new master password here — this browser opens the key and locks it again.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LifeBuoy, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import * as C from "@/lib/vault/vault-crypto";
import { dropRequestKey, errMsg, loadRequestKey, saveRequestKey, useVault } from "../_lib/session";
import { PasswordInput, ResetVault } from "./Auth";
import { StrengthBar } from "./bits";

type Mine = { id: number; status: "pending" | "approved" | "declined" | "expired"; createdAt: string; expiresAt: string; wrappedKey: string | null; recoveryPriv: string | null; recoveryPublicKey: string | null; recoveryVersion: number | null } | null;

export function RecoveryFlow({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const me = useVault((s) => s.me);
  const { data: mine, isLoading, refetch } = useQuery({ queryKey: ["vault", "recovery", "mine"], queryFn: async () => (await api.get<Mine>("/vault/recovery/request")).data, refetchInterval: 20_000 });
  const [acct, setAcct] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const uid = me?.user.id ?? 0;

  const ask = async () => {
    setBusy(true);
    try {
      const k = await C.newRequestKeys();
      await saveRequestKey(uid, k.privateKey);
      await api.post("/vault/recovery/request", { accountPassword: acct, publicKey: k.publicKey });
      setAcct(""); toast.success("Sent to the Administrator"); await refetch();
    } catch (e) { toast.error(errMsg(e, "Couldn't send the request.")); } finally { setBusy(false); }
  };
  const cancel = async () => { await api.post("/vault/recovery/request/cancel").catch(() => null); await dropRequestKey(uid); await refetch(); };
  const finish = async () => {
    if (!mine?.wrappedKey || !mine.recoveryPriv) return;
    setBusy(true);
    try {
      const key = await loadRequestKey(uid);
      if (!key) throw new Error("This browser doesn't have the request's key. Ask again from this browser.");
      const r = await C.completeRecovery({ wrappedKey: mine.wrappedKey, requestPrivateKey: key, recoveryPriv: mine.recoveryPriv, newPassword: pw, recoveryPublicKey: mine.recoveryPublicKey });
      await api.post("/vault/recovery/complete", { requestId: mine.id, ...r.fields, ...(r.wrap ? { recovery: { ...r.wrap, version: mine.recoveryVersion } } : {}) });
      await dropRequestKey(uid);
      const fresh = (await api.get("/vault/me")).data;
      useVault.getState().setMe(fresh);
      await useVault.getState().open(r.privateKey);
      qc.setQueryData(["vault", "me"], fresh);
      toast.success("Your vault is back. Remember the new master password.");
    } catch (e: any) { toast.error(e?.response ? errMsg(e, "Couldn't finish.") : (e?.message ?? "Couldn't finish.")); } finally { setBusy(false); }
  };

  if (reset) return <ResetVault onBack={() => setReset(false)} />;
  const s = C.strength(pw);
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-product-vault/12 text-product-vault ring-1 ring-product-vault/25"><LifeBuoy className="h-6 w-6" /></span>
      <h1 className="mt-4 font-serif text-[26px] leading-tight">Forgot your master password?</h1>
      {isLoading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" /> : !mine || mine.status === "expired" ? (
        <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="mt-2 space-y-3">
          <p className="text-[13.5px] text-muted-foreground">Ask the Administrator to recover your vault. Nothing is lost, and they still can&apos;t read your passwords. Finish it later <strong>in this same browser</strong>.</p>
          {mine?.status === "expired" && <p className="text-[12.5px] text-[#b45309]">Your last request expired. You can ask again.</p>}
          <PasswordInput label="Your EZ Manage account password" value={acct} onChange={setAcct} autoComplete="current-password" autoFocus />
          <button type="submit" disabled={!acct || busy} className="h-11 w-full rounded-lg bg-forest text-[14px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{busy ? "Sending…" : "Ask the Administrator"}</button>
        </form>
      ) : mine.status === "pending" ? (
        <div className="mt-3 space-y-3 text-[13.5px]">
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" /> Waiting for the Administrator. You&apos;ll get a notification; this page updates by itself. The request expires {new Date(mine.expiresAt).toLocaleDateString()}.</p>
          <button type="button" onClick={cancel} className="text-[12.5px] text-muted-foreground hover:text-foreground">Cancel the request</button>
        </div>
      ) : mine.status === "approved" ? (
        <form onSubmit={(e) => { e.preventDefault(); void finish(); }} className="mt-2 space-y-3">
          <p className="flex items-start gap-2 text-[13.5px]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Approved. Choose a new master password to open your vault.</p>
          <PasswordInput label="New master password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus />
          <StrengthBar value={pw ? s : -1} />
          <PasswordInput label="Type it again" value={pw2} onChange={setPw2} autoComplete="new-password" />
          {pw2 && pw !== pw2 && <p className="text-[12px] text-destructive">The two don&apos;t match.</p>}
          <button type="submit" disabled={busy || pw.length < 10 || s < 2 || pw !== pw2} className="h-11 w-full rounded-lg bg-forest text-[14px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{busy ? "Opening…" : "Set new master password"}</button>
        </form>
      ) : (
        <div className="mt-3 space-y-3 text-[13.5px]">
          <p className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> The Administrator declined your request. Talk to them, then ask again.</p>
          <button type="button" onClick={cancel} className="h-10 rounded-lg border border-border px-3 text-[13px] hover:bg-accent">Ask again</button>
        </div>
      )}
      <div className="mt-5 flex justify-between text-[12.5px]">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">Back</button>
        <button type="button" onClick={() => setReset(true)} className="text-destructive/80 hover:text-destructive">Reset and start empty instead</button>
      </div>
    </div>
  );
}
