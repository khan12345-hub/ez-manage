"use client";

import { useState } from "react";
import { Hash, MessageSquare, Plus, Users, X } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { createChannel, getOrCreateDM, getChannels, getDMs, getWorkspaceMembers } from "@/services/chat.api";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatChannel } from "@/services/chat.api";

interface Props {
  onClose: () => void;
}

export function ChatSidebar({ onClose }: Props) {
  const { user } = useAuth();
  const { workspaceId } = useInviteModalStore();
  const {
    channels, dms, activeChannelId, unreadCounts, onlineUserIds,
    setActiveChannel, setChannels, setDMs, clearUnread,
  } = useChatStore();

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [members, setMembers] = useState<{ user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[]>([]);

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

  return (
    <div className="flex h-full w-56 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Chat</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

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
            <div className="mx-2 mb-1 rounded border border-slate-200 bg-white shadow-sm">
              {members.map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => handleStartDM(m.user.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={m.user.avatarUrl ?? undefined} />
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
            return (
              <button
                key={dm.id}
                onClick={() => handleSelectChannel(dm)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  activeChannelId === dm.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={other.user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {other.user.firstName[0]}{other.user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                      isOnline ? "bg-green-500" : "bg-slate-300"
                    }`}
                  />
                </div>
                <span className="flex-1 truncate">
                  {other.user.firstName} {other.user.lastName}
                </span>
                {unread > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
