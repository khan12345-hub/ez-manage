"use client";

import { useState } from "react";
import { Hash, MessageSquare, Plus, Smile, X } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { createChannel, getOrCreateDM, getChannels, getDMs, getWorkspaceMembers, setUserStatus } from "@/services/chat.api";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfilePanel } from "@/components/UserProfilePanel";
import type { ChatChannel } from "@/services/chat.api";
import { resolveUrl } from "@/lib/resolveUrl";

interface Props {
  onClose: () => void;
}

interface ProfileState {
  userId: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  dmChannelId: number;
  statusEmoji?: string | null;
  statusText?: string | null;
}

const PRESET_STATUSES = [
  { emoji: "🗓️", text: "In a meeting" },
  { emoji: "🏖️", text: "On vacation" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🏠", text: "Working from home" },
  { emoji: "🎯", text: "Focusing" },
  { emoji: "🚫", text: "Do not disturb" },
] as const;

const CLEAR_AFTER_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
  { label: "Today", value: "today" },
] as const;

const av = (url?: string | null) => url ? resolveUrl(url) : undefined;

export function ChatSidebar({ onClose }: Props) {
  const { user } = useAuth();
  const { workspaceId } = useInviteModalStore();
  const {
    channels, dms, activeChannelId, unreadCounts, onlineUserIds, userStatuses,
    setActiveChannel, setChannels, setDMs, clearUnread, setUserStatus: storeSetStatus,
  } = useChatStore();

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [members, setMembers] = useState<{ user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[]>([]);
  const [profile, setProfile] = useState<ProfileState | null>(null);

  // My status picker state
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusEmoji, setStatusEmoji] = useState("");
  const [statusText, setStatusText] = useState("");
  const [clearAfter, setClearAfter] = useState<number | "today" | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const myStatus = user
    ? (userStatuses[user.id] ?? { emoji: user.chatStatusEmoji ?? null, text: user.chatStatusText ?? null })
    : null;

  const handleSelectChannel = (channel: ChatChannel) => {
    setActiveChannel(channel.id);
    clearUnread(channel.id);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !workspaceId) return;
    await createChannel(workspaceId, newChannelName.trim());
    const updated = await getChannels(workspaceId);
    setChannels(updated);
    setNewChannelName("");
    setShowNewChannel(false);
  };

  const handleOpenDMPicker = async () => {
    if (!workspaceId) return;
    const list = await getWorkspaceMembers(workspaceId);
    setMembers(list.filter((m) => m.user.id !== user?.id));
    setShowDMPicker(true);
  };

  const handleStartDM = async (targetUserId: number) => {
    if (!workspaceId) return;
    const dm = await getOrCreateDM(workspaceId, targetUserId);
    const updatedDMs = await getDMs(workspaceId);
    setDMs(updatedDMs);
    setActiveChannel(dm.id);
    clearUnread(dm.id);
    setShowDMPicker(false);
  };

  const openProfile = (dm: ChatChannel) => {
    const other = dm.members.find((m) => m.user && m.userId !== user?.id);
    if (!other?.user) return;
    const liveStatus = userStatuses[other.user.id];
    setProfile({
      userId: other.user.id,
      firstName: other.user.firstName,
      lastName: other.user.lastName,
      avatarUrl: other.user.avatarUrl,
      isOnline: onlineUserIds.has(other.user.id),
      dmChannelId: dm.id,
      statusEmoji: liveStatus?.emoji ?? (other.user as any).chatStatusEmoji ?? null,
      statusText: liveStatus?.text ?? (other.user as any).chatStatusText ?? null,
    });
  };

  const openStatusPicker = () => {
    setStatusEmoji(myStatus?.emoji ?? "");
    setStatusText(myStatus?.text ?? "");
    setClearAfter(null);
    setShowStatusPicker(true);
  };

  const handleSaveStatus = async () => {
    if (!user) return;
    setSavingStatus(true);
    try {
      let clearsAt: string | null = null;
      if (clearAfter === "today") {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        clearsAt = end.toISOString();
      } else if (typeof clearAfter === "number") {
        clearsAt = new Date(Date.now() + clearAfter * 60 * 1000).toISOString();
      }
      await setUserStatus(statusEmoji || null, statusText || null, clearsAt);
      storeSetStatus(user.id, statusEmoji || null, statusText || null);
      setShowStatusPicker(false);
    } catch {
      // ignore
    } finally {
      setSavingStatus(false);
    }
  };

  const handleClearStatus = async () => {
    if (!user) return;
    await setUserStatus(null, null, null);
    storeSetStatus(user.id, null, null);
    setShowStatusPicker(false);
  };

  return (
    <div className="relative flex h-full w-56 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
        <span className="text-sm font-semibold text-slate-700">Chat</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* My Status bar */}
      <button
        onClick={openStatusPicker}
        className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        <span className="text-base leading-none">
          {myStatus?.emoji || <Smile className="h-4 w-4 text-slate-400" />}
        </span>
        <span className="flex-1 truncate text-xs text-slate-500">
          {myStatus?.text || "Set a status…"}
        </span>
      </button>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels */}
        <div className="mb-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Channels
            </span>
            <button
              onClick={() => setShowNewChannel(true)}
              className="text-slate-400 hover:text-slate-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showNewChannel && (
            <div className="mx-2 mb-1 flex gap-1">
              <input
                autoFocus
                placeholder="channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateChannel();
                  if (e.key === "Escape") setShowNewChannel(false);
                }}
                className="flex-1 rounded border border-slate-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          )}

          {channels.map((ch) => {
            const unread = unreadCounts[ch.id] ?? 0;
            return (
              <button
                key={ch.id}
                onClick={() => handleSelectChannel(ch)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{ch.name}</span>
                {unread > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Direct Messages */}
        <div>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Direct Messages
            </span>
            <button
              onClick={handleOpenDMPicker}
              className="text-slate-400 hover:text-slate-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDMPicker && (
            <div className="mx-2 mb-1 rounded border border-border bg-popover shadow-sm">
              {members.map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => handleStartDM(m.user.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={av(m.user.avatarUrl)} />
                    <AvatarFallback className="text-[9px]">
                      {m.user.firstName[0]}{m.user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  {m.user.firstName} {m.user.lastName}
                </button>
              ))}
            </div>
          )}

          {dms.map((dm) => {
            const other = dm.members.find((m) => m.user && m.userId !== user?.id);
            if (!other?.user) return null;
            const isOnline = onlineUserIds.has(other.user.id);
            const unread = unreadCounts[dm.id] ?? 0;
            const liveStatus = userStatuses[other.user.id];
            const statusEmoji = liveStatus?.emoji ?? (other.user as any).chatStatusEmoji;
            return (
              <div
                key={dm.id}
                className={`group flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                  activeChannelId === dm.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {/* Avatar → open profile */}
                <button
                  onClick={() => openProfile(dm)}
                  className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  title="View profile"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={other.user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {other.user.firstName[0]}{other.user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  {statusEmoji ? (
                    <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none">{statusEmoji}</span>
                  ) : (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                        isOnline ? "bg-green-500" : "bg-slate-300"
                      }`}
                    />
                  )}
                </button>

                {/* Name → open DM */}
                <button
                  onClick={() => handleSelectChannel(dm)}
                  className="flex flex-1 items-center gap-1 truncate text-left"
                >
                  <span className="flex-1 truncate">
                    {other.user.firstName} {other.user.lastName}
                  </span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status Picker Panel ── */}
      {showStatusPicker && (
        <div className="absolute bottom-0 left-56 z-50 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Set a status</span>
            <button onClick={() => setShowStatusPicker(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Presets */}
          <div className="px-3 pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Quick pick</p>
            <div className="grid grid-cols-2 gap-1">
              {PRESET_STATUSES.map((p) => (
                <button
                  key={p.text}
                  onClick={() => { setStatusEmoji(p.emoji); setStatusText(p.text); }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    statusEmoji === p.emoji && statusText === p.text
                      ? "bg-indigo-50 text-indigo-700"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="truncate">{p.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className="px-3 pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custom</p>
            <div className="flex gap-2">
              <input
                value={statusEmoji}
                onChange={(e) => setStatusEmoji(e.target.value)}
                placeholder="😊"
                maxLength={2}
                className="w-12 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="What's your status?"
                maxLength={100}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Clear after */}
          <div className="px-3 pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Clear after</p>
            <div className="flex flex-wrap gap-1">
              {CLEAR_AFTER_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setClearAfter(opt.value as any)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    clearAfter === opt.value
                      ? "bg-indigo-100 text-indigo-700 font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-3 py-3">
            <button
              onClick={handleClearStatus}
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Clear status
            </button>
            <button
              onClick={handleSaveStatus}
              disabled={savingStatus}
              className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {savingStatus ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ── User Profile Panel ── */}
      {profile && (
        <div className="absolute bottom-0 left-56 z-50 flex h-[520px] w-64 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <UserProfilePanel
            user={{
              id: profile.userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              avatarUrl: profile.avatarUrl,
            }}
            isOnline={profile.isOnline}
            isCurrentUser={false}
            workspaceId={workspaceId ?? 0}
            statusEmoji={profile.statusEmoji}
            statusText={profile.statusText}
            onClose={() => setProfile(null)}
            onSendMessage={() => {
              handleSelectChannel({ id: profile.dmChannelId } as ChatChannel);
              setProfile(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
