"use client";

/*
 * Executive Hub → My profile: the Administrator's own profile in one place.
 * Hero (cover, avatar upload with a square crop, name, title, status) and cards that edit inline:
 * personal info, email signature (added to Executive Hub emails), password, notifications,
 * what is connected (calendars, EZ Vault, companies) and the person's numbers.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  BellRing, Building2, CalendarDays, Camera, Check, Clock3, Crown, Eye, EyeOff, Globe2, KeyRound, Loader2, Lock, Mail, MessageCircle,
  Pencil, Phone, PenLine, Search, Settings2, ShieldCheck, Smile, UserRound, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { resolveUrl } from "@/lib/resolveUrl";
import { useAuth } from "@/providers/AuthProvider";
import { setUserStatus } from "@/services/chat.api";
import { getNotificationPreferences, getWhatsappSettings, updateNotificationPreferences } from "@/services/users.api";
import { calendarApi } from "@/services/calendar.api";
import { ceoApi, type CeoOverview } from "@/services/ceo-tower.api";

type Me = {
  id: number; firstName: string; lastName: string; email: string; phone: string | null; avatarUrl: string | null; systemRole: string;
  createdAt: string; lastLoginAt: string | null; jobTitle: string | null; timezone: string | null; bio: string | null; emailSignature: string | null;
  chatStatusEmoji: string | null; chatStatusText: string | null; chatStatusClearsAt: string | null;
};

const fade: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const glass = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";
const input = "h-10 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const errMsg = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m[0] : typeof m === "string" ? m : fallback;
};

/** PATCH /users/me/settings (multipart) — only the fields given */
async function saveProfile(fields: Record<string, string | null>, avatar?: Blob) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v ?? "");
  if (avatar) fd.append("avatar", avatar, "avatar.jpg");
  return (await api.patch("/users/me/settings", fd)).data;
}

/** square, centred crop → 512×512 JPEG */
async function squareCrop(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = Math.min(512, side);
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("crop"))), "image/jpeg", 0.9));
  } finally { URL.revokeObjectURL(url); }
}

const STATUS_PRESETS = [
  { emoji: "🗓️", text: "In a meeting" }, { emoji: "🎯", text: "Focusing" }, { emoji: "✈️", text: "Traveling" },
  { emoji: "🏖️", text: "On vacation" }, { emoji: "🏠", text: "Working from home" }, { emoji: "🚫", text: "Do not disturb" },
];
const PW_RULES = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p: string) => /\d/.test(p), label: "A number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "A special character" },
];

function Section({ icon: Icon, title, sub, editing, onEdit, onCancel, onSave, saving, children, className }: {
  icon: typeof UserRound; title: string; sub?: string; editing?: boolean; onEdit?: () => void; onCancel?: () => void; onSave?: () => void; saving?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.section variants={fade} aria-label={title} className={cn(glass, "flex flex-col p-5", className)}>
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-brass-soft"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><h2 className="text-[15.5px] font-semibold tracking-tight">{title}</h2>{sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}</span>
        {onEdit && !editing && <button type="button" onClick={onEdit} className="flex h-8 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[12.5px] font-semibold hover:bg-accent"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
        {editing && (
          <span className="flex gap-1.5">
            <button type="button" onClick={onCancel} disabled={saving} className="h-8 rounded-xl px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="flex h-8 items-center gap-1.5 rounded-xl bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save</button>
          </span>
        )}
      </header>
      {children}
    </motion.section>
  );
}

function Field({ label, icon: Icon, value, children }: { label: string; icon?: typeof UserRound; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
      {children ?? <span className="block min-h-[22px] text-[14px]">{value || <span className="text-muted-foreground">—</span>}</span>}
    </label>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-[#047857] dark:bg-[#059669]" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function ProfileView({ data, onView, onBrief }: { data: CeoOverview; onView: (v: "calendar") => void; onBrief: () => void }) {
  const { user } = useAuth();
  const me = user as Me | null;
  const qc = useQueryClient();
  const reduced = useReducedMotion();
  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] });

  // ── hero: avatar ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const avatar = useMutation({
    mutationFn: async (file: File) => {
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error("Pick a PNG, JPG, WebP or GIF image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("The picture must be 5 MB or smaller.");
      const blob = await squareCrop(file);
      setPreview(URL.createObjectURL(blob));
      return saveProfile({}, blob);
    },
    onSuccess: () => { refresh(); toast.success("Profile picture updated"); },
    onError: (e: any) => { setPreview(null); toast.error(e?.message && !e?.response ? e.message : errMsg(e, "Couldn't upload the picture.")); },
  });
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // ── status ──
  const [statusOpen, setStatusOpen] = useState(false);
  const [stEmoji, setStEmoji] = useState("");
  const [stText, setStText] = useState("");
  const status = useMutation({
    mutationFn: (s: { emoji: string | null; text: string | null }) => setUserStatus(s.emoji, s.text, null),
    onSuccess: (_, s) => { refresh(); setStatusOpen(false); toast.success(s.text ? "Status set" : "Status cleared"); },
    onError: () => toast.error("Couldn't update your status."),
  });

  // ── personal info ──
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ firstName: "", lastName: "", jobTitle: "", phone: "", timezone: "", bio: "" });
  const startInfo = () => { if (!me) return; setInfo({ firstName: me.firstName ?? "", lastName: me.lastName ?? "", jobTitle: me.jobTitle ?? "", phone: me.phone ?? "", timezone: me.timezone ?? "", bio: me.bio ?? "" }); setEditInfo(true); };
  const saveInfo = useMutation({
    mutationFn: () => {
      if (!info.firstName.trim() || !info.lastName.trim()) throw new Error("First and last name are required.");
      return saveProfile({ firstName: info.firstName.trim(), lastName: info.lastName.trim(), jobTitle: info.jobTitle, phone: info.phone, timezone: info.timezone, bio: info.bio });
    },
    onSuccess: () => { refresh(); setEditInfo(false); toast.success("Profile saved"); },
    onError: (e: any) => toast.error(e?.response ? errMsg(e, "Couldn't save.") : e?.message ?? "Couldn't save."),
  });
  const zones = useMemo<string[]>(() => { try { return (Intl as any).supportedValuesOf("timeZone"); } catch { return ["UTC"]; } }, []);
  const [tzQ, setTzQ] = useState("");
  const tzList = zones.filter((z) => z.toLowerCase().includes(tzQ.trim().toLowerCase().replace(/\s+/g, "_"))).slice(0, 60);
  const localTime = (tz: string | null) => { try { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz || undefined }); } catch { return ""; } };

  // ── signature ──
  const [editSig, setEditSig] = useState(false);
  const [sig, setSig] = useState("");
  const saveSig = useMutation({
    mutationFn: () => saveProfile({ emailSignature: sig }),
    onSuccess: () => { refresh(); setEditSig(false); toast.success(sig.trim() ? "Signature saved" : "Signature removed"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't save the signature.")),
  });

  // ── password ──
  const [editPw, setEditPw] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [showPw, setShowPw] = useState(false);
  const passed = PW_RULES.filter((r) => r.test(pw.next)).length;
  const savePw = useMutation({
    mutationFn: () => {
      if (passed < PW_RULES.length) throw new Error("The new password doesn't meet every rule yet.");
      if (pw.next !== pw.again) throw new Error("The two new passwords don't match.");
      if (!pw.current) throw new Error("Type your current password.");
      return saveProfile({ currentPassword: pw.current, newPassword: pw.next });
    },
    onSuccess: () => { setEditPw(false); setPw({ current: "", next: "", again: "" }); toast.success("Password changed"); },
    onError: (e: any) => toast.error(e?.response ? errMsg(e, "Couldn't change the password.") : e?.message),
  });

  // ── notifications / connected / numbers ──
  const { data: prefs } = useQuery({ queryKey: ["me", "notification-preferences"], queryFn: getNotificationPreferences });
  const prefsMut = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (p) => { qc.setQueryData(["me", "notification-preferences"], p); toast.success("Notification settings saved"); },
    onError: () => toast.error("Couldn't save."),
  });
  const { data: wa } = useQuery({ queryKey: ["me", "whatsapp-settings"], queryFn: getWhatsappSettings, retry: false });
  const { data: cal } = useQuery({ queryKey: ["calendar", "accounts"], queryFn: calendarApi.accounts, retry: false });
  const { data: assigned } = useQuery({ queryKey: ["ceo-tower", "assigned", "summary", "all", null], queryFn: () => ceoApi.assigned(), staleTime: 30_000 });

  if (!me) return <div className="h-[420px] animate-pulse rounded-[28px] bg-muted" />;
  const avatarSrc = preview ?? (me.avatarUrl ? resolveUrl(me.avatarUrl) : null);
  const initials = `${me.firstName?.[0] ?? ""}${me.lastName?.[0] ?? ""}`.toUpperCase();
  const since = new Date(me.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const lastIn = me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  const s = assigned?.summary;

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      {/* hero */}
      <motion.section variants={fade} aria-label="Profile" className={cn(glass, "overflow-hidden")}>
        <div className="relative h-36 overflow-hidden bg-forest sm:h-44 dark:bg-[#0d2a20]">
          <div aria-hidden className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <motion.div aria-hidden className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brass/35 blur-3xl" animate={reduced ? undefined : { scale: [1, 1.1, 1] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
          <div aria-hidden className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#34d399]/25 blur-3xl" />
        </div>
        <div className="relative px-5 pb-5 sm:px-7">
          <div className="-mt-14 flex flex-wrap items-end gap-4">
            <div className="relative">
              <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#b08d57] to-[#8a6a35] text-[34px] font-semibold text-white ring-4 ring-white shadow-[0_18px_40px_-18px_rgba(11,42,31,0.8)] dark:ring-[#14181a]">
                {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : initials}
                {avatar.isPending && <span className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/40"><Loader2 className="h-6 w-6 animate-spin text-white" /></span>}
              </span>
              <button type="button" aria-label="Change profile picture" title="Change picture (square, up to 5 MB)" onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-forest text-brass-soft ring-4 ring-white transition hover:brightness-110 dark:bg-primary dark:text-primary-foreground dark:ring-[#14181a]"><Camera className="h-4 w-4" /></button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) avatar.mutate(f); e.target.value = ""; }} />
            </div>
            <div className="min-w-0 basis-full pb-1 sm:basis-0 sm:flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-[26px] font-semibold leading-tight tracking-tight">
                {me.firstName} {me.lastName}
                {me.systemRole === "SUPER_ADMIN" && <span className="inline-flex items-center gap-1 rounded-full bg-[#b08d57]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#8a6a35] ring-1 ring-[#b08d57]/30 dark:text-[#d9bd8c]"><Crown className="h-3.5 w-3.5" /> Administrator</span>}
              </h1>
              <p className="text-[13.5px] text-muted-foreground">{me.jobTitle || "Add your job title"} · {me.email}</p>
            </div>
            <div className="relative pb-1">
              <button type="button" onClick={() => { setStEmoji(me.chatStatusEmoji ?? ""); setStText(me.chatStatusText ?? ""); setStatusOpen((o) => !o); }} aria-expanded={statusOpen}
                className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-[13px] font-medium hover:bg-accent">
                {me.chatStatusText ? <><span>{me.chatStatusEmoji}</span><span className="max-w-[180px] truncate">{me.chatStatusText}</span></> : <><Smile className="h-4 w-4 text-muted-foreground" /> Set a status</>}
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-12 z-20 w-[290px] rounded-2xl border border-border bg-popover p-3 shadow-xl">
                  <div className="flex gap-2">
                    <input value={stEmoji} onChange={(e) => setStEmoji(e.target.value.slice(0, 4))} aria-label="Status emoji" placeholder="🙂" className={cn(input, "w-12 px-2 text-center")} />
                    <input value={stText} onChange={(e) => setStText(e.target.value.slice(0, 100))} aria-label="Status text" placeholder="What's your status?" className={input} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {STATUS_PRESETS.map((p) => <button key={p.text} type="button" onClick={() => { setStEmoji(p.emoji); setStText(p.text); }} className="truncate rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent">{p.emoji} {p.text}</button>)}
                  </div>
                  <div className="mt-2 flex justify-between gap-2">
                    {me.chatStatusText && <button type="button" onClick={() => status.mutate({ emoji: null, text: null })} className="h-8 rounded-lg px-2.5 text-[12.5px] text-destructive hover:bg-destructive/10">Clear</button>}
                    <span className="flex-1" />
                    <button type="button" disabled={!stText.trim() || status.isPending} onClick={() => status.mutate({ emoji: stEmoji || null, text: stText.trim() })} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Save</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Member since {since}</span>
            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Last sign-in {lastIn}</span>
            {me.timezone && <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" /> {me.timezone.replace(/_/g, " ")} · {localTime(me.timezone)}</span>}
            {me.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {me.phone}</span>}
          </div>
          {me.bio && <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-foreground/80">{me.bio}</p>}
        </div>
      </motion.section>

      <motion.div variants={stagger} className="grid items-start gap-4 xl:grid-cols-2">
        {/* personal info */}
        <Section icon={UserRound} title="Personal info" sub="How people see you across EZ Manage" editing={editInfo} onEdit={startInfo} onCancel={() => setEditInfo(false)} onSave={() => saveInfo.mutate()} saving={saveInfo.isPending}>
          {editInfo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name"><input value={info.firstName} onChange={(e) => setInfo({ ...info, firstName: e.target.value })} maxLength={50} className={input} /></Field>
              <Field label="Last name"><input value={info.lastName} onChange={(e) => setInfo({ ...info, lastName: e.target.value })} maxLength={50} className={input} /></Field>
              <Field label="Job title"><input value={info.jobTitle} onChange={(e) => setInfo({ ...info, jobTitle: e.target.value })} maxLength={80} placeholder="e.g. Chief Executive Officer" className={input} /></Field>
              <Field label="Phone"><input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} maxLength={20} placeholder="+92 300 1234567" inputMode="tel" className={input} /></Field>
              <Field label="Time zone">
                <div className="rounded-xl border border-border bg-background">
                  <span className="flex items-center gap-2 px-3 pt-2 text-[13px]"><Globe2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="flex-1 truncate font-medium">{info.timezone ? info.timezone.replace(/_/g, " ") : "Not set (uses this device)"}</span>{info.timezone && <button type="button" aria-label="Clear time zone" onClick={() => setInfo({ ...info, timezone: "" })} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}</span>
                  <span className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={tzQ} onChange={(e) => setTzQ(e.target.value)} placeholder="Search a city, e.g. Karachi" aria-label="Search time zones" className="w-full bg-transparent text-[13px] outline-none" /></span>
                  <ul className="max-h-36 overflow-y-auto py-1" role="listbox" aria-label="Time zones">
                    {tzList.map((z) => <li key={z}><button type="button" role="option" aria-selected={info.timezone === z} onClick={() => setInfo({ ...info, timezone: z })} className={cn("flex w-full justify-between px-3 py-1 text-left text-[12.5px] hover:bg-accent", info.timezone === z && "bg-accent font-semibold")}><span className="truncate">{z.replace(/_/g, " ")}</span><span className="text-muted-foreground">{localTime(z)}</span></button></li>)}
                  </ul>
                </div>
              </Field>
              <Field label="About"><textarea value={info.bio} onChange={(e) => setInfo({ ...info, bio: e.target.value })} maxLength={500} rows={6} placeholder="A line or two about you and what you look after" className={cn(input, "h-auto resize-none py-2")} /><span className="mt-1 block text-right text-[11px] text-muted-foreground">{info.bio.length}/500</span></Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={`${me.firstName} ${me.lastName}`} />
              <Field label="Job title" icon={Building2} value={me.jobTitle} />
              <Field label="Email" icon={Mail} value={<span className="flex items-center gap-1.5">{me.email}<Lock className="h-3 w-3 text-muted-foreground" aria-label="Email can't be changed here" /></span>} />
              <Field label="Phone" icon={Phone} value={me.phone} />
              <Field label="Time zone" icon={Globe2} value={me.timezone ? `${me.timezone.replace(/_/g, " ")} · ${localTime(me.timezone)} now` : null} />
              <Field label="About" value={me.bio} />
            </div>
          )}
        </Section>

        {/* email signature */}
        <Section icon={PenLine} title="Email signature" sub="Added under every email you send from Executive Hub" editing={editSig} onEdit={() => { setSig(me.emailSignature ?? ""); setEditSig(true); }} onCancel={() => setEditSig(false)} onSave={() => saveSig.mutate()} saving={saveSig.isPending}>
          {editSig && <><textarea value={sig} onChange={(e) => setSig(e.target.value)} maxLength={2000} rows={5} aria-label="Email signature" placeholder={`${me.firstName} ${me.lastName}\n${me.jobTitle ?? "Chief Executive Officer"}\n${me.phone ?? "+92 300 1234567"}`} className={cn(input, "h-auto resize-y py-2 font-mono text-[12.5px]")} /><span className="mt-1 block text-right text-[11px] text-muted-foreground">{sig.length}/2000</span></>}
          <div className={cn("rounded-2xl border border-dashed border-border bg-background/60 p-4 text-[13px]", editSig && "mt-2")}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Preview</p>
            <p className="text-foreground/80">Hi Rubab, please share the Q4 numbers by Friday.</p>
            {(editSig ? sig : me.emailSignature)?.trim() ? <p className="mt-3 whitespace-pre-line border-t border-border/60 pt-3 text-foreground/90">{(editSig ? sig : me.emailSignature)!.trim()}</p> : <p className="mt-3 border-t border-border/60 pt-3 italic text-muted-foreground">No signature yet.</p>}
            <p className="mt-3 text-[11.5px] text-muted-foreground">— {me.firstName} {me.lastName}, via EZ Manage Executive Hub</p>
          </div>
        </Section>

        {/* security */}
        <Section icon={ShieldCheck} title="Password & security" sub="Change the password you sign in with" editing={editPw} onEdit={() => setEditPw(true)} onCancel={() => { setEditPw(false); setPw({ current: "", next: "", again: "" }); }} onSave={() => savePw.mutate()} saving={savePw.isPending}>
          {editPw ? (
            <div className="space-y-3">
              {(["current", "next", "again"] as const).map((k) => (
                <Field key={k} label={k === "current" ? "Current password" : k === "next" ? "New password" : "New password again"}>
                  <span className="relative block">
                    <input type={showPw ? "text" : "password"} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} autoComplete={k === "current" ? "current-password" : "new-password"} className={cn(input, "pr-10")} />
                    {k === "current" && <button type="button" aria-label={showPw ? "Hide passwords" : "Show passwords"} onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
                  </span>
                </Field>
              ))}
              <div>
                <div className="flex h-1.5 gap-1" aria-hidden>{PW_RULES.map((_, i) => <span key={i} className={cn("flex-1 rounded-full transition", i < passed ? (passed === 4 ? "bg-[#047857] dark:bg-[#059669]" : passed >= 2 ? "bg-[#d97706]" : "bg-[#dc2626]") : "bg-muted")} />)}</div>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-[12px]">
                  {PW_RULES.map((r) => { const ok = r.test(pw.next); return <li key={r.label} className={cn("flex items-center gap-1.5", ok ? "text-[#047857] dark:text-[#34d399]" : "text-muted-foreground")}>{ok ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}{r.label}</li>; })}
                  <li className={cn("flex items-center gap-1.5", pw.again && pw.again === pw.next ? "text-[#047857] dark:text-[#34d399]" : "text-muted-foreground")}>{pw.again && pw.again === pw.next ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}Both match</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-[13px]">
              <p className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-[#b08d57]" /> Password: <span className="tracking-[0.3em]">••••••••</span></p>
              <p className="text-muted-foreground">Use 8+ characters with an uppercase letter, a number and a special character. Keep your company passwords in <Link href="/vault" className="font-semibold text-primary hover:underline">EZ Vault</Link>.</p>
            </div>
          )}
        </Section>

        {/* notifications */}
        <Section icon={BellRing} title="Notifications" sub="Where EZ Manage reaches you">
          <ul className="divide-y divide-border/60">
            <li className="flex items-center gap-3 py-2.5"><Mail className="h-4 w-4 text-muted-foreground" /><span className="flex-1"><span className="block text-[13.5px] font-medium">Email</span><span className="block text-[12px] text-muted-foreground">Assignments, mentions and updates by email</span></span><Toggle label="Email notifications" on={!!prefs?.emailNotificationsEnabled} disabled={!prefs || prefsMut.isPending} onChange={(v) => prefsMut.mutate({ emailNotificationsEnabled: v })} /></li>
            <li className="flex items-center gap-3 py-2.5"><BellRing className="h-4 w-4 text-muted-foreground" /><span className="flex-1"><span className="block text-[13.5px] font-medium">In the app</span><span className="block text-[12px] text-muted-foreground">The bell and Attention needed</span></span><Toggle label="In-app notifications" on={!!prefs?.inAppNotificationsEnabled} disabled={!prefs || prefsMut.isPending} onChange={(v) => prefsMut.mutate({ inAppNotificationsEnabled: v })} /></li>
            <li className="flex items-center gap-3 py-2.5"><MessageCircle className="h-4 w-4 text-muted-foreground" /><span className="flex-1"><span className="block text-[13.5px] font-medium">WhatsApp</span><span className="block text-[12px] text-muted-foreground">{wa?.whatsappEnabled && wa.whatsappPhoneVerified ? `On · ${wa.whatsappPhone}` : wa?.whatsappPhone && !wa.whatsappPhoneVerified ? "Number not verified yet" : "Not set up"}</span></span><Link href="/settings" className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary/10">{wa?.whatsappEnabled ? "Manage" : "Set up"}</Link></li>
            <li className="flex items-center gap-3 py-2.5"><Settings2 className="h-4 w-4 text-[#b08d57]" /><span className="flex-1"><span className="block text-[13.5px] font-medium">Morning brief & alerts</span><span className="block text-[12px] text-muted-foreground">Executive Hub's daily brief and risk alerts</span></span><button type="button" onClick={onBrief} className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary/10">Open</button></li>
          </ul>
        </Section>

        {/* connected */}
        <Section icon={Globe2} title="Connected" sub="Accounts and tools linked to you">
          <ul className="space-y-2">
            <li className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]"><CalendarDays className="h-4 w-4 text-[#0369a1]" /><span className="flex-1 text-[13.5px]"><b>{cal?.accounts.length ?? 0}</b> Google {cal?.accounts.length === 1 ? "calendar" : "calendars"}{cal && !cal.configured && <span className="block text-[12px] text-muted-foreground">Google sign-in isn't set up on this server yet</span>}</span><button type="button" onClick={() => onView("calendar")} className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary/10">Calendar</button></li>
            <li className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]"><KeyRound className="h-4 w-4 text-[#0f766e]" /><span className="flex-1 text-[13.5px]">EZ Vault — your passwords, locked</span><Link href="/vault" className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary/10">Open</Link></li>
            <li className="rounded-2xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
              <span className="flex items-center gap-3 text-[13.5px]"><Building2 className="h-4 w-4 text-[#b08d57]" /><span className="flex-1"><b>{data.companies.length}</b> {data.companies.length === 1 ? "company" : "companies"} in your Executive Hub</span></span>
              {data.companies.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5 pl-7">{data.companies.slice(0, 8).map((c) => <span key={c.key} className="rounded-full bg-background px-2 py-0.5 text-[11.5px] ring-1 ring-border">{c.name} · {c.source === "work" ? "Work" : "Accounts"}</span>)}{data.companies.length > 8 && <span className="text-[11.5px] text-muted-foreground">+{data.companies.length - 8} more</span>}</span>}
            </li>
          </ul>
        </Section>

        {/* numbers */}
        <Section icon={Crown} title="Your numbers" sub="Across every company you look after" className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["Companies", data.kpis.companies, ""],
              ["People", data.kpis.people, ""],
              ["You assigned", s?.total ?? "…", ""],
              ["Done", s?.done ?? "…", "text-[#047857] dark:text-[#34d399]"],
              ["Open", s?.open ?? "…", ""],
              ["Overdue", s?.overdue ?? "…", s?.overdue ? "text-[#dc2626] dark:text-[#f87171]" : ""],
            ] as const).map(([l, v, cls]) => (
              <div key={l} className="rounded-2xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
                <p className="text-[11.5px] font-medium text-muted-foreground">{l}</p>
                <p className={cn("mt-1 text-[24px] font-bold leading-none tabular-nums", cls)}>{v}</p>
              </div>
            ))}
          </div>
        </Section>
      </motion.div>
    </motion.div>
  );
}
