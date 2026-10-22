"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getKeyStatus, setDashboardKey, unlockDashboard } from "@/services/ceo-assistant.api";
import { useAuth } from "@/providers/AuthProvider";
import { CeoDashboardShell } from "./CeoDashboardShell";

const SESSION_KEY = "ceo_dashboard_unlocked";

function isUnlocked(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markUnlocked() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
}
function clearUnlock() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

// ── Shared fullscreen wrapper ─────────────────────────────────────────────────
function FullScreenDark({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "linear-gradient(135deg,#eef2ff 0%,#fafbff 50%,#f5f3ff 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.07) 0%, transparent 65%)" }}
      />
      <div className="relative z-10 w-full max-w-sm mx-4">{children}</div>
    </div>
  );
}

// ── Lock card shell ───────────────────────────────────────────────────────────
function LockCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-3xl bg-white"
      style={{
        border: "1px solid #e0e7ff",
        boxShadow: "0 20px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col items-center px-8 pb-6 pt-10" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 4px 16px rgba(99,102,241,0.12)" }}
        >
          {icon}
        </div>
        <h2 className="text-xl font-black text-slate-800">{title}</h2>
        <p className="mt-1.5 text-center text-sm text-slate-500">{subtitle}</p>
      </div>
      {/* Body */}
      <div className="px-8 py-7">{children}</div>
    </div>
  );
}

// ── Styled input ──────────────────────────────────────────────────────────────
function LockInput({ value, onChange, onKeyDown, placeholder, type = "password", right, inputRef }: {
  value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder: string; type?: string; right?: React.ReactNode;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(99,102,241,0.5)"; (e.target as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)"; }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; (e.target as HTMLInputElement).style.boxShadow = "none"; }}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

// ── Primary button ────────────────────────────────────────────────────────────
function LockBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-40"
      style={{ background: "linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}
    >
      {disabled ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : children}
    </button>
  );
}

// ── Toggle show/hide icon ─────────────────────────────────────────────────────
function ShowToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="text-slate-400 hover:text-slate-600 transition-colors">
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

// ── Set-key form (reused in two places) ──────────────────────────────────────
function SetKeyForm({ onSave, onCancel, isPending, error, setError }: {
  onSave: (key: string) => void; onCancel?: () => void; isPending: boolean;
  error: string; setError: (v: string) => void;
}) {
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [show, setShow] = useState(false);

  const save = () => {
    if (k1.length < 4) { setError("Key must be at least 4 characters."); return; }
    if (k1 !== k2) { setError("Keys do not match."); return; }
    setError(""); onSave(k1);
  };

  return (
    <div className="space-y-3">
      <LockInput value={k1} onChange={(v) => { setK1(v); setError(""); }} placeholder="New access key…"
        type={show ? "text" : "password"} right={<ShowToggle show={show} onToggle={() => setShow(!show)} />} />
      <LockInput value={k2} onChange={(v) => { setK2(v); setError(""); }} placeholder="Confirm access key…"
        type={show ? "text" : "password"} />
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      <LockBtn onClick={save} disabled={!k1 || !k2 || isPending}>Save Access Key</LockBtn>
      {onCancel && (
        <button onClick={onCancel} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1">
          Cancel
        </button>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface Props { children: React.ReactNode; }

export function CeoDashboardLock({ children }: Props) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";

  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"unlock" | "setkey">("unlock");
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!authLoading && user && !isSuperAdmin) router.replace("/");
  }, [authLoading, user, isSuperAdmin]);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ceo-key-status"],
    queryFn: getKeyStatus,
    enabled: !unlocked && isSuperAdmin,
  });

  useEffect(() => {
    if (!unlocked && !statusLoading) setTimeout(() => inputRef.current?.focus(), 120);
  }, [unlocked, statusLoading]);

  const unlockMut = useMutation({
    mutationFn: unlockDashboard,
    onSuccess: () => { markUnlocked(); setUnlocked(true); },
    onError: () => setError("Incorrect key. Please try again."),
  });

  const setKeyMut = useMutation({
    mutationFn: setDashboardKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceo-key-status"] });
      setMode("unlock"); setKey(""); setError("");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to set key."),
  });

  const handleUnlock = () => {
    if (!key.trim()) return;
    setError("");
    unlockMut.mutate(key.trim());
  };

  const handleLock = () => { clearUnlock(); setUnlocked(false); setKey(""); setMode("unlock"); };

  // ── Not authorized / loading ──
  if (authLoading || !user || !isSuperAdmin) {
    return (
      <FullScreenDark>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      </FullScreenDark>
    );
  }

  // ── Unlocked → render dashboard shell + page content ──
  if (unlocked) {
    return (
      <CeoDashboardShell onLock={handleLock}>
        {children}
      </CeoDashboardShell>
    );
  }

  // ── Status loading ──
  if (statusLoading) {
    return (
      <FullScreenDark>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      </FullScreenDark>
    );
  }

  const hasKey = status?.hasKey ?? false;

  // ── No key set yet ──
  if (!hasKey) {
    return (
      <FullScreenDark>
        <LockCard
          icon={<ShieldCheck className="h-7 w-7 text-emerald-500" />}
          title="Set Access Key"
          subtitle="Create a private passphrase to protect the CEO dashboard."
        >
          <SetKeyForm
            onSave={setKeyMut.mutate}
            isPending={setKeyMut.isPending}
            error={error}
            setError={setError}
          />
        </LockCard>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          CEO Analytics · Private Access
        </p>
      </FullScreenDark>
    );
  }

  // ── Enter passphrase ──
  return (
    <FullScreenDark>
      <LockCard
        icon={<KeyRound className="h-7 w-7 text-indigo-500" />}
        title={mode === "unlock" ? "CEO Dashboard" : "Change Access Key"}
        subtitle={
          mode === "unlock"
            ? "Enter your private key to unlock the dashboard."
            : "Set a new passphrase for future access."
        }
      >
        {mode === "unlock" ? (
          <div className="space-y-3">
            <LockInput
              value={key}
              onChange={(v) => { setKey(v); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Enter access key…"
              type={show ? "text" : "password"}
              inputRef={inputRef as React.RefObject<HTMLInputElement>}
              right={<ShowToggle show={show} onToggle={() => setShow(!show)} />}
            />
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <LockBtn onClick={handleUnlock} disabled={!key.trim() || unlockMut.isPending}>
              Unlock Dashboard
            </LockBtn>
            <button
              onClick={() => { setMode("setkey"); setError(""); }}
              className="w-full text-center text-xs pt-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              Change access key
            </button>
          </div>
        ) : (
          <SetKeyForm
            onSave={setKeyMut.mutate}
            onCancel={() => { setMode("unlock"); setError(""); }}
            isPending={setKeyMut.isPending}
            error={error}
            setError={setError}
          />
        )}
      </LockCard>
      <p className="mt-4 text-center text-[11px] text-slate-400">
        CEO Analytics · Private Access
      </p>
    </FullScreenDark>
  );
}
