"use client";

import {
  ChangeEvent,
  RefObject,
  Dispatch,
  SetStateAction,
  useState,
} from "react";
import {
  Camera, Smile, Mail, Phone, CalendarDays,
  Clock, CheckCircle2, X, Pencil,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/FormInput";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setUserStatus } from "@/services/chat.api";
import { User } from "./ProfileSettings";
import { resolveUrl } from "@/lib/resolveUrl";

const STATUS_PRESETS = [
  { emoji: "🗓️", text: "In a meeting" },
  { emoji: "🏖️", text: "On vacation" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🏠", text: "Working from home" },
  { emoji: "🎯", text: "Focusing" },
  { emoji: "🚫", text: "Do not disturb" },
  { emoji: "☕", text: "On a break" },
  { emoji: "✈️", text: "Traveling" },
] as const;

function formatJoined(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatLastSeen(iso?: string | null) {
  if (!iso) return "Never";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ProfileSectionProps {
  user: User;
  previewUrl: string | null;
  setPreviewUrl: Dispatch<SetStateAction<string | null>>;
  setAvatar: Dispatch<SetStateAction<File | null>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export function ProfileSection({
  user,
  previewUrl,
  setPreviewUrl,
  setAvatar,
  fileInputRef,
}: ProfileSectionProps) {
  const qc = useQueryClient();
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  const imageSrc = previewUrl
    ? previewUrl.startsWith("blob:")
      ? previewUrl
      : resolveUrl(previewUrl)
    : undefined;

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  // ── Status — local display state (updated instantly on save) ────────────
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  // Displayed values: start from user prop, then kept in local state after any save
  const [displayEmoji, setDisplayEmoji] = useState<string | null>(
    (user as any).chatStatusEmoji ?? null,
  );
  const [displayText, setDisplayText] = useState<string | null>(
    (user as any).chatStatusText ?? null,
  );
  // Edit-form values
  const [statusEmoji, setStatusEmoji] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("");

  const hasStatus = !!(displayEmoji || displayText);

  const statusMutation = useMutation({
    mutationFn: ({ emoji, text }: { emoji: string | null; text: string | null }) =>
      setUserStatus(emoji, text, null),
    onSuccess: (_, vars) => {
      // Update local display immediately — no need to wait for query cache propagation
      setDisplayEmoji(vars.emoji);
      setDisplayText(vars.text);
      // Also sync global cache so other components (e.g. profile panel) see the change
      qc.setQueryData(["auth", "me"], (old: any) =>
        old ? { ...old, chatStatusEmoji: vars.emoji, chatStatusText: vars.text } : old,
      );
      toast.success(vars.emoji || vars.text ? "Status updated" : "Status cleared");
      setShowStatusEdit(false);
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleSaveStatus = () =>
    statusMutation.mutate({ emoji: statusEmoji || null, text: statusText || null });

  const handleClearStatus = () =>
    statusMutation.mutate({ emoji: null, text: null });

  return (
    <div className="flex flex-col gap-6">

      {/* ── Profile preview card ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-r from-muted via-indigo-500/5 to-violet-500/5">
          <div className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 50%, #8b5cf6 0%, transparent 50%)",
            }}
          />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative shrink-0">
              <div
                className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-full ring-4 ring-background shadow-md"
                onClick={() => fileInputRef.current?.click()}
              >
                {imageSrc ? (
                  <img src={imageSrc} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-indigo-100 text-xl font-bold text-indigo-600">
                    {initials || "U"}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-background bg-green-500" />
            </div>

            <div className="mb-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {user.firstName} {user.lastName}
                </h2>
                {hasStatus && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {displayEmoji && <span>{displayEmoji}</span>}
                    {displayText && <span className="truncate max-w-32">{displayText}</span>}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Info row */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Member since {formatJoined((user as any).createdAt)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Last active {formatLastSeen((user as any).lastLoginAt)}
            </span>
            {(user as any).phone && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {(user as any).phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Profile card ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Update your name and profile photo.</p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-border">
              {imageSrc ? (
                <img src={imageSrc} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-indigo-500/10 text-base font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                  {initials || "U"}
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs"
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                Change photo
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG or WEBP · max 5 MB</p>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput name="firstName" label="First name" />
            <FormInput name="lastName" label="Last name" />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email address
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              {user.email}
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Locked
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Contact support to change your email address.</p>
          </div>
        </div>
      </section>

      {/* ── Status card ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Status</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Let your team know what you're up to.
            </p>
          </div>
          {hasStatus && !showStatusEdit && (
            <button
              type="button"
              onClick={() => { setStatusEmoji(displayEmoji ?? ""); setStatusText(displayText ?? ""); setShowStatusEdit(true); }}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {/* Current status display */}
          {hasStatus && !showStatusEdit && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              {displayEmoji && <span className="text-lg leading-none">{displayEmoji}</span>}
              <span className="text-sm font-medium text-foreground">{displayText}</span>
              <button
                type="button"
                onClick={handleClearStatus}
                disabled={statusMutation.isPending}
                className="ml-auto text-muted-foreground transition hover:text-foreground"
                title="Clear status"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {(!hasStatus || showStatusEdit) && (
            <div className="flex flex-col gap-4">
              {/* Input row */}
              <div className="flex gap-2">
                <input
                  value={statusEmoji}
                  onChange={(e) => setStatusEmoji(e.target.value)}
                  placeholder="😊"
                  maxLength={2}
                  className="w-12 rounded-lg border border-border bg-background px-2 py-2.5 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
                <input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="What's your status?"
                  maxLength={100}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {STATUS_PRESETS.map((p) => (
                  <button
                    key={p.text}
                    type="button"
                    onClick={() => { setStatusEmoji(p.emoji); setStatusText(p.text); }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      statusEmoji === p.emoji && statusText === p.text
                        ? "border-indigo-300 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{p.emoji}</span>
                    <span className="truncate">{p.text}</span>
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {statusMutation.isPending ? "Saving…" : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Save status</>
                  )}
                </button>
                {hasStatus && (
                  <button
                    type="button"
                    onClick={handleClearStatus}
                    disabled={statusMutation.isPending}
                    className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition hover:bg-muted"
                  >
                    Clear
                  </button>
                )}
                {showStatusEdit && (
                  <button
                    type="button"
                    onClick={() => setShowStatusEdit(false)}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {!hasStatus && !showStatusEdit && (
            <button
              type="button"
              onClick={() => setShowStatusEdit(true)}
              className="flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Smile className="h-4 w-4" />
              Set a status
            </button>
          )}
        </div>
      </section>

    </div>
  );
}
