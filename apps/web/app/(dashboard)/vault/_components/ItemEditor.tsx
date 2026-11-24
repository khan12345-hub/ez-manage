"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Eye, EyeOff, FileText, Fingerprint, Globe, IdCard, Plus, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { createItem, errMsg, typeLabel, updateItem, updateItemEverywhere, sameLoginElsewhere, useVault, type Item, type ItemData, type ItemType } from "../_lib/session";
import { canWrite } from "../_lib/session";
import { Generator, StrengthBar } from "./bits";

const TYPES: { type: ItemType; icon: typeof Globe }[] = [{ type: "login", icon: Globe }, { type: "passkey", icon: Fingerprint }, { type: "note", icon: FileText }, { type: "card", icon: CreditCard }, { type: "identity", icon: IdCard }];

/** generate a WebAuthn-style passkey (ES256 / P-256) in the browser; stored encrypted like everything else */
async function makePasskey(rpId: string, username: string) {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const [priv, pub] = await Promise.all([crypto.subtle.exportKey("jwk", kp.privateKey), crypto.subtle.exportKey("jwk", kp.publicKey)]);
  return { rpId, username, credentialId: C.toB64(C.randomBytes(16)), publicKey: JSON.stringify(pub), privateKey: JSON.stringify(priv), alg: "ES256", createdAt: new Date().toISOString() };
}
const input = "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50";

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-medium text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}

export function ItemEditor({ item, defaultVault, defaultType, onClose, onSaved }: { item: Item | null; defaultVault?: string; defaultType?: ItemType; onClose: () => void; onSaved: (uid?: string) => void }) {
  const { vaults, items } = useVault();
  const writable = vaults.filter((v) => canWrite(v.role));
  const [type, setType] = useState<ItemType>(item?.data.type ?? defaultType ?? "login");
  const [vaultUid, setVaultUid] = useState(item?.vaultUid ?? (writable.find((v) => v.uid === defaultVault) ?? writable[0])?.uid ?? "");
  const [d, setD] = useState<ItemData>(item?.data ?? { type: "login", title: "", urls: [""], username: "", password: "", notes: "", tags: [] });
  const [showPw, setShowPw] = useState(!item);
  const [busy, setBusy] = useState(false);
  const [propagate, setPropagate] = useState(false);
  const set = (p: Partial<ItemData>) => setD((x) => ({ ...x, ...p }));
  const urls = d.urls?.length ? d.urls : [""];
  const reused = d.password && items.filter((i) => i.uid !== item?.uid && i.data.password === d.password).length;
  // editing a login whose password changed, and the same login exists in other vaults we manage
  const pwChanged = !!item && type === "login" && (d.password ?? "") !== (item.data.password ?? "");
  const elsewhere = pwChanged ? sameLoginElsewhere(item, { ...d, type, urls }).length : 0;

  const save = async () => {
    const title = d.title.trim() || (type === "login" ? C.hostOf(urls[0] ?? "") : type === "passkey" ? (d.passkey?.rpId ?? "") : "") || "Untitled";
    const data: ItemData = { ...d, type, title, urls: urls.map((u) => u.trim()).filter(Boolean), tags: (d.tags ?? []).filter(Boolean) };
    if (type === "login" && d.password !== item?.data.password) data.passwordUpdatedAt = new Date().toISOString();
    if (data.totp && !(await C.totp(data.totp).catch(() => null))) { toast.error("That one-time code secret isn't valid."); return; }
    setBusy(true);
    try {
      let uid = item?.uid;
      if (item && propagate && elsewhere > 0) {
        const { updated } = await updateItemEverywhere(item, data, vaultUid);
        toast.success(updated > 0 ? `Saved · password updated in ${updated} other vault${updated > 1 ? "s" : ""}` : "Saved");
      } else if (item) {
        await updateItem(item, data, vaultUid);
        toast.success("Saved");
      } else {
        uid = await createItem(vaultUid, data);
        toast.success("Added");
      }
      onSaved(uid);
      onClose();
    } catch (e) { toast.error(errMsg(e, "Couldn't save.")); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{item ? `Edit ${typeLabel[type].toLowerCase()}` : "New item"}</DialogTitle>
        <DialogDescription className="sr-only">Everything here is encrypted in your browser before it is saved.</DialogDescription>
        {!item && (
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map((t) => <button key={t.type} type="button" aria-pressed={type === t.type} onClick={() => setType(t.type)} className={cn("flex flex-col items-center gap-1 rounded-lg border py-2 text-[11.5px] font-medium", type === t.type ? "border-product-vault bg-product-vault/8" : "border-border hover:bg-accent")}><t.icon className="h-4 w-4" />{typeLabel[t.type]}</button>)}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
          <L label="Title"><input autoFocus className={input} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={type === "login" ? "e.g. Company Gmail" : ""} /></L>
          {type === "login" && (
            <>
              <L label="Username or email"><input className={input} value={d.username ?? ""} onChange={(e) => set({ username: e.target.value })} autoComplete="off" spellCheck={false} /></L>
              <L label="Password">
                <div className="flex items-center rounded-md border border-border bg-background pr-1 focus-within:border-primary/50">
                  <input className="h-9 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[13.5px] outline-none" type={showPw ? "text" : "password"} value={d.password ?? ""} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" spellCheck={false} aria-label="Password" />
                  <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(!showPw)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <Generator onUse={(pw) => { set({ password: pw }); setShowPw(true); }} />
                </div>
                {d.password ? <div className="mt-1.5"><StrengthBar value={C.strength(d.password)} /></div> : null}
                {!!reused && <p className="mt-1 text-[11.5px] text-[#b45309]">This password is already used in {reused} other item{reused > 1 ? "s" : ""}.</p>}
              </L>
              <L label="Websites">
                <div className="space-y-1.5">
                  {urls.map((u, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input className={input} value={u} onChange={(e) => set({ urls: urls.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="https://example.com/login" aria-label={`Website ${i + 1}`} />
                      {urls.length > 1 && <button type="button" aria-label="Remove website" onClick={() => set({ urls: urls.filter((_, j) => j !== i) })} className="rounded-md px-2 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>}
                    </div>
                  ))}
                  <button type="button" onClick={() => set({ urls: [...urls, ""] })} className="flex items-center gap-1 text-[12px] font-medium text-primary"><Plus className="h-3.5 w-3.5" /> Add website</button>
                </div>
              </L>
              <L label="One-time code secret (2FA, optional)"><input className={cn(input, "font-mono")} value={d.totp ?? ""} onChange={(e) => set({ totp: e.target.value })} placeholder="Secret key or otpauth:// link" spellCheck={false} autoComplete="off" /></L>
            </>
          )}
          {type === "passkey" && (
            <>
              <L label="Website / app"><input className={input} value={d.passkey?.rpId ?? ""} onChange={(e) => set({ passkey: { ...d.passkey, rpId: e.target.value } })} placeholder="example.com" spellCheck={false} autoComplete="off" /></L>
              <L label="Username or email"><input className={input} value={d.passkey?.username ?? ""} onChange={(e) => set({ passkey: { ...d.passkey, username: e.target.value } })} autoComplete="off" spellCheck={false} /></L>
              {d.passkey?.credentialId ? (
                <div className="rounded-lg border border-product-vault/25 bg-product-vault/5 p-3 text-[12.5px]">
                  <p className="flex items-center gap-1.5 font-medium text-product-vault"><Fingerprint className="h-4 w-4" /> Passkey created{d.passkey.createdAt ? ` · ${new Date(d.passkey.createdAt).toLocaleDateString()}` : ""}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">ID: {d.passkey.credentialId.slice(0, 24)}… · {d.passkey.alg ?? "ES256"}</p>
                  <button type="button" onClick={async () => set({ passkey: await makePasskey(d.passkey?.rpId ?? "", d.passkey?.username ?? "") })} className="mt-2 flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</button>
                </div>
              ) : (
                <button type="button" onClick={async () => set({ passkey: await makePasskey(d.passkey?.rpId ?? "", d.passkey?.username ?? "") })} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-forest px-3 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Fingerprint className="h-4 w-4" /> Generate passkey</button>
              )}
              <p className="text-[11.5px] text-muted-foreground">The private key is encrypted in your browser and stored here — the server never sees it. (Signing in to sites directly with it comes later.)</p>
            </>
          )}
          {type === "card" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><L label="Cardholder"><input className={input} value={d.card?.holder ?? ""} onChange={(e) => set({ card: { ...d.card, holder: e.target.value } })} /></L></div>
              <div className="col-span-2"><L label="Card number"><input className={cn(input, "font-mono")} inputMode="numeric" value={d.card?.number ?? ""} onChange={(e) => set({ card: { ...d.card, number: e.target.value } })} autoComplete="off" /></L></div>
              <L label="Expires (MM/YY)"><input className={input} value={d.card?.expiry ?? ""} onChange={(e) => set({ card: { ...d.card, expiry: e.target.value } })} placeholder="08/29" /></L>
              <L label="Security code"><input className={cn(input, "font-mono")} value={d.card?.cvv ?? ""} onChange={(e) => set({ card: { ...d.card, cvv: e.target.value } })} autoComplete="off" /></L>
              <L label="PIN"><input className={cn(input, "font-mono")} value={d.card?.pin ?? ""} onChange={(e) => set({ card: { ...d.card, pin: e.target.value } })} autoComplete="off" /></L>
            </div>
          )}
          {type === "identity" && (
            <div className="grid grid-cols-2 gap-3">
              {(["fullName", "email", "phone", "company"] as const).map((k) => <L key={k} label={{ fullName: "Full name", email: "Email", phone: "Phone", company: "Company" }[k]}><input className={input} value={d.identity?.[k] ?? ""} onChange={(e) => set({ identity: { ...d.identity, [k]: e.target.value } })} /></L>)}
              <div className="col-span-2"><L label="Address"><textarea className={cn(input, "h-auto py-2")} rows={2} value={d.identity?.address ?? ""} onChange={(e) => set({ identity: { ...d.identity, address: e.target.value } })} /></L></div>
            </div>
          )}
          <L label={type === "note" ? "Note" : "Notes"}><textarea className={cn(input, "h-auto py-2")} rows={type === "note" ? 8 : 3} value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></L>
          <L label="Tags (comma separated)"><input className={input} value={(d.tags ?? []).join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()) })} /></L>
          <L label="Vault">
            <select className={input} value={vaultUid} onChange={(e) => setVaultUid(e.target.value)} aria-label="Vault">
              {writable.map((v) => <option key={v.uid} value={v.uid}>{v.name}{v.kind === "shared" ? ` (shared, ${v.members})` : ""}</option>)}
            </select>
          </L>
          {elsewhere > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-product-vault/25 bg-product-vault/5 px-3 py-2 text-[12.5px]">
              <input type="checkbox" checked={propagate} onChange={(e) => setPropagate(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]" />
              <span>Also update this password in <strong>{elsewhere} other vault{elsewhere > 1 ? "s" : ""}</strong> that have the same login. Only vaults you manage are changed; copies in vaults you can’t open aren’t touched.</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
            <button type="submit" disabled={busy || !vaultUid} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
