"use client";

import { useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

import {
  getWhatsappSettings,
  getWhatsappLogs,
  sendWhatsappOtp,
  updateWhatsappSettings,
  verifyWhatsappOtp,
  type WhatsappSettingsUpdatePayload,
} from "@/services/users.api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Country list ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+1",   flag: "🇺🇸", name: "United States" },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇨🇦", name: "Canada" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
] as const;

type Country = typeof COUNTRIES[number];

function detectCountry(phone: string): { country: Country; local: string } {
  const defaultCountry = COUNTRIES[0];
  if (!phone) return { country: defaultCountry, local: "" };
  const stripped = phone.replace(/\D/g, "");
  for (const c of COUNTRIES) {
    const code = c.code.replace("+", "");
    if (stripped.startsWith(code)) {
      return { country: c, local: stripped.slice(code.length) };
    }
  }
  return { country: defaultCountry, local: stripped };
}

// ── Per-event preferences ─────────────────────────────────────────────────────
const EVENT_PREFS = [
  { key: "whatsappOnAssigned",   label: "Task assigned to me" },
  { key: "whatsappOnStatus",     label: "Status changed" },
  { key: "whatsappOnDate",       label: "Due date approaching" },
  { key: "whatsappOnComment",    label: "New comment" },
  { key: "whatsappOnMention",    label: "I'm mentioned" },
  { key: "whatsappOnAutomation", label: "Automation triggered" },
] as const;

type PrefKey = typeof EVENT_PREFS[number]["key"];
type Step = "idle" | "otp-sent" | "verified";

// ── OTP Box component ─────────────────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
}) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(6, " ").split("");
    arr[i] = digit || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (digit && i < 5) refs[i + 1]?.current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      const arr = value.padEnd(6, " ").split("");
      if (!arr[i]?.trim() && i > 0) {
        refs[i - 1]?.current?.focus();
      } else {
        arr[i] = " ";
        onChange(arr.join("").trimEnd());
      }
    }
    if (e.key === "Enter" && value.replace(/\s/g, "").length === 6) onComplete();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs[Math.min(pasted.length, 5)]?.current?.focus();
  };

  return (
    <div className="flex gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => {
        const digit = value[i] ?? "";
        const filled = digit.trim() !== "";
        return (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit.trim()}
            autoFocus={i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              "h-12 w-10 rounded-lg border-2 bg-white text-center text-xl font-semibold tabular-nums outline-none transition-all duration-150",
              "focus:border-[#25D366] focus:shadow-[0_0_0_3px_rgba(37,211,102,0.15)]",
              filled
                ? "border-[#25D366] text-[#0F172A]"
                : "border-[#E5E9F0] text-[#0F172A]",
            )}
          />
        );
      })}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] disabled:opacity-40",
        checked ? "bg-[#25D366]" : "bg-[#CBD5E1]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function WhatsappSettingsSection() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: getWhatsappSettings,
  });

  // Phone state
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [initialized, setInitialized] = useState(false);
  const [otp, setOtp] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Sync once
  if (data && !initialized) {
    const detected = detectCountry(data.whatsappPhone ?? "");
    setCountry(detected.country);
    setLocalNumber(detected.local);
    setStep(data.whatsappPhoneVerified ? "verified" : "idle");
    setInitialized(true);
  }

  const fullPhone = `${country.code.replace("+", "")}${localNumber}`;
  const storedPhone = data?.whatsappPhone ?? "";
  const phoneChanged = fullPhone !== storedPhone.replace(/\D/g, "") && localNumber !== "";

  // Mutations
  const saveMutation = useMutation({
    mutationFn: () => updateWhatsappSettings({ whatsappPhone: fullPhone }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["whatsapp-settings"], updated);
      setInitialized(false);
      setStep("idle");
      toast.success("Phone number saved.");
    },
    onError: () => toast.error("Failed to save phone number."),
  });

  const prefMutation = useMutation({
    mutationFn: (payload: WhatsappSettingsUpdatePayload) => updateWhatsappSettings(payload),
    onSuccess: (updated) => queryClient.setQueryData(["whatsapp-settings"], updated),
    onError: () => toast.error("Failed to update preference."),
  });

  const sendOtpMutation = useMutation({
    mutationFn: sendWhatsappOtp,
    onSuccess: () => {
      setStep("otp-sent");
      setOtp("");
      toast.success("Code sent to your WhatsApp.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to send code.");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyWhatsappOtp(otp.replace(/\s/g, "")),
    onSuccess: (res) => {
      queryClient.setQueryData(["whatsapp-settings"], (old: any) => ({
        ...old,
        whatsappPhoneVerified: true,
        whatsappEnabled: true,
      }));
      setStep("verified");
      setOtp("");
      toast.success(res.message);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Incorrect code.");
      setOtp("");
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["whatsapp-logs"],
    queryFn: () => getWhatsappLogs(1, 30),
    enabled: showHistory,
  });

  const otpComplete = otp.replace(/\s/g, "").length === 6;

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl rounded-2xl border border-[#E5E9F0] bg-white p-6">
        <div className="h-40 animate-pulse rounded-xl bg-[#F1F5F9]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-[#E5E9F0] bg-white shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-3.5 border-b border-[#E5E9F0] px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5]">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#0F172A]">WhatsApp Notifications</h2>
          <p className="text-[13px] text-[#64748B]">Receive task updates and control Ez-Manage from WhatsApp.</p>
        </div>
        {step === "verified" && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-[12px] font-medium text-[#16A34A]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </span>
        )}
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">

        {/* ── Phone input ── */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#374151]">WhatsApp number</label>
          <div className={cn(
            "flex overflow-hidden rounded-xl border-2 bg-white transition-all duration-200",
            "focus-within:border-[#25D366] focus-within:shadow-[0_0_0_3px_rgba(37,211,102,0.12)]",
            phoneChanged ? "border-[#25D366]" : "border-[#E5E9F0]",
          )}>
            {/* Country selector */}
            <div className="relative flex shrink-0 items-center border-r border-[#E5E9F0] bg-[#F8FAFC]">
              <select
                value={country.code + country.flag}
                onChange={(e) => {
                  const found = COUNTRIES.find((c) => c.code + c.flag === e.target.value);
                  if (found) { setCountry(found); if (step !== "idle") setStep("idle"); }
                }}
                className="h-full appearance-none bg-transparent py-3 pl-3 pr-7 text-[14px] font-medium text-[#0F172A] outline-none"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.flag + c.code} value={c.code + c.flag}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#94A3B8]" />
            </div>

            {/* Number input */}
            <input
              type="tel"
              placeholder="3001234567"
              value={localNumber}
              onChange={(e) => {
                setLocalNumber(e.target.value.replace(/\D/g, ""));
                if (step !== "idle") setStep("idle");
              }}
              className="h-full flex-1 bg-transparent px-3.5 py-3 text-[14px] text-[#0F172A] placeholder-[#CBD5E1] outline-none"
            />
          </div>
          <p className="text-[12px] text-[#94A3B8]">Numbers only, no spaces or dashes.</p>
        </div>

        {/* Save button */}
        {phoneChanged && localNumber && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-fit rounded-lg bg-[#25D366] text-white hover:bg-[#1EB858] h-9 px-5 text-[13px] font-medium shadow-none"
          >
            {saveMutation.isPending ? "Saving…" : "Save number"}
          </Button>
        )}

        {/* ── Verify section ── */}
        {!phoneChanged && data?.whatsappPhone && step !== "verified" && (
          <div className={cn(
            "rounded-xl border-2 p-5 transition-all duration-300",
            step === "otp-sent"
              ? "border-[#25D366] bg-[#F0FBF5]"
              : "border-[#E5E9F0] bg-[#F8FAFC]",
          )}>

            {step === "idle" && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[14px] font-medium text-[#0F172A]">Verify your number</p>
                  <p className="mt-0.5 text-[13px] text-[#64748B]">
                    We'll send a 6-digit code to{" "}
                    <span className="font-mono font-semibold text-[#0F172A]">{data.whatsappPhone}</span>
                  </p>
                </div>
                <Button
                  onClick={() => sendOtpMutation.mutate()}
                  disabled={sendOtpMutation.isPending}
                  className="w-fit rounded-lg bg-[#0F172A] text-white hover:bg-[#1E293B] h-9 px-5 text-[13px] font-medium shadow-none"
                >
                  {sendOtpMutation.isPending ? "Sending…" : "Send verification code"}
                </Button>
              </div>
            )}

            {step === "otp-sent" && (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-[14px] font-medium text-[#0F172A]">Enter the 6-digit code</p>
                  <p className="mt-0.5 text-[13px] text-[#64748B]">
                    Sent to <span className="font-mono font-semibold text-[#0F172A]">{data.whatsappPhone}</span>
                  </p>
                </div>

                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={() => { if (otpComplete) verifyMutation.mutate(); }}
                />

                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => verifyMutation.mutate()}
                    disabled={!otpComplete || verifyMutation.isPending}
                    className="rounded-lg bg-[#25D366] text-white hover:bg-[#1EB858] h-9 px-5 text-[13px] font-medium shadow-none disabled:opacity-40"
                  >
                    {verifyMutation.isPending ? "Verifying…" : "Verify"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => sendOtpMutation.mutate()}
                    disabled={sendOtpMutation.isPending}
                    className="text-[13px] text-[#64748B] underline-offset-2 hover:text-[#0F172A] hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Verified: per-event prefs ── */}
        {step === "verified" && !phoneChanged && data && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium text-[#374151]">Notify me on WhatsApp when…</p>
            <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E5E9F0] overflow-hidden">
              {EVENT_PREFS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between bg-white px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                  <span className="text-[13px] text-[#374151]">{label}</span>
                  <Toggle
                    checked={data[key]}
                    disabled={prefMutation.isPending}
                    onChange={() => prefMutation.mutate({ [key]: !data[key] } as WhatsappSettingsUpdatePayload)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Verified: commands ── */}
        {step === "verified" && !phoneChanged && (
          <div className="rounded-xl border border-[#E5E9F0] bg-[#F8FAFC] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              WhatsApp Commands
            </p>
            <div className="grid grid-cols-1 gap-y-1.5 text-[12px] sm:grid-cols-2 sm:gap-x-8">
              {[
                ["BOARDS", "List your boards"],
                ["BOARD {name}", "Switch board"],
                ["TODAY", "Tasks due today"],
                ["MY", "Tasks assigned to you"],
                ["ALL", "All tasks in board"],
                ["TASKS", "Your recent tasks"],
                ["{number}", "Select from list"],
                ["INFO", "Task details"],
                ["STATUS {label}", "Change status"],
                ["COMMENT {text}", "Add comment"],
                ["DONE", "Mark as done"],
                ["EXTEND", "Due date +1 day"],
                ["MOVE {group}", "Move to group"],
                ["NEW {name}", "Create a task"],
                ["MEMBERS", "Board members"],
                ["STOP / START", "Toggle notifications"],
                ["HELP", "All commands"],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex gap-2">
                  <span className="font-mono font-semibold text-[#0F172A]">{cmd}</span>
                  <span className="text-[#94A3B8]">— {desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Message history ── */}
        {step === "verified" && !phoneChanged && (
          <div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] text-[#64748B] transition-colors hover:text-[#0F172A]"
            >
              {showHistory
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />}
              Message history
            </button>

            {showHistory && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#E5E9F0]">
                {logsLoading ? (
                  <div className="p-4 text-[13px] text-[#94A3B8]">Loading…</div>
                ) : !logsData?.data.length ? (
                  <div className="p-4 text-[13px] text-[#94A3B8]">No messages yet.</div>
                ) : (
                  <div className="max-h-64 divide-y divide-[#F1F5F9] overflow-y-auto">
                    {logsData.data.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                        <span className={cn(
                          "mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                          log.direction === "OUT"
                            ? "bg-[#ECFDF5] text-[#16A34A]"
                            : "bg-[#EFF6FF] text-[#2563EB]",
                        )}>
                          {log.direction === "OUT" ? "Sent" : "Recv"}
                        </span>
                        <span className="flex-1 break-words text-[12px] text-[#374151]">{log.body}</span>
                        <span className="shrink-0 tabular-nums text-[11px] text-[#94A3B8]">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
