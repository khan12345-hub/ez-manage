"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Hash, MessageSquare, Plus, Send, Trash2, Video,
  Users, Search, X, Loader2, Phone,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useChatStore } from "@/store/chat-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { getSocket } from "@/components/Chat/ChatProvider";
import {
  getChannels, getDMs, getMessages, getOrCreateDM,
  createChannel, deleteMessage, getWorkspaceMembers,
  joinChannel, markRead,
} from "@/services/chat.api";
import type { ChatChannel, ChatMessage } from "@/services/chat.api";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams();
  const workspaceId = Number(Array.isArray(params.workspaceId) ? params.workspaceId[0] : params.workspaceId);
  const { user } = useAuth();
  const { setWorkspace } = useInviteModalStore();

  const {
    channels, dms, messages, activeChannelId, unreadCounts, onlineUserIds,
    setChannels, setDMs, setActiveChannel, setMessages, addMessage,
    incrementUnread, clearUnread, setUserOnline, setUserOffline,
  } = useChatStore();

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [members, setMembers] = useState<{ userId: number; user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [input, setInput] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const activeChannelRef = useRef<number | null>(null);

  useEffect(() => { setWorkspace(workspaceId); }, [workspaceId]);
  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  // Load sidebar data
  useEffect(() => {
    if (!workspaceId || !user) return;
    getChannels(workspaceId).then(setChannels).catch(() => {});
    getDMs(workspaceId).then(setDMs).catch(() => {});
    getWorkspaceMembers(workspaceId).then((list) =>
      setMembers(list.filter((m) => m.user && m.userId !== user.id))
    ).catch(() => {});
  }, [workspaceId, user?.id]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const onMsg = (msg: ChatMessage) => {
      addMessage(msg);
      if (msg.channelId !== activeChannelRef.current) incrementUnread(msg.channelId);
    };
    const onOnline = ({ userId }: { userId: number }) => setUserOnline(userId);
    const onOffline = ({ userId }: { userId: number }) => setUserOffline(userId);
    const onTypingStart = (d: { userId: number; userName: string; channelId: number }) => {
      if (d.channelId === activeChannelRef.current && d.userId !== user.id) setTypingUser(d.userName);
    };
    const onTypingStop = (d: { channelId: number }) => {
      if (d.channelId === activeChannelRef.current) setTypingUser(null);
    };

    socket.on("message:new", onMsg);
    socket.on("user:online", onOnline);
    socket.on("user:offline", onOffline);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    return () => {
      socket.off("message:new", onMsg);
      socket.off("user:online", onOnline);
      socket.off("user:offline", onOffline);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
    };
  }, [user?.id]);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannelId || !workspaceId) return;
    setLoadingMessages(true);
    clearUnread(activeChannelId);
    markRead(workspaceId, activeChannelId).catch(() => {});
    getMessages(workspaceId, activeChannelId)
      .then((msgs) => setMessages(activeChannelId, msgs))
      .finally(() => setLoadingMessages(false));

    const socket = getSocket();
    socket?.emit("channel:join", { channelId: activeChannelId });
  }, [activeChannelId, workspaceId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[activeChannelId ?? 0]?.length]);

  const allChannels = [...channels, ...dms];
  const activeChannel = allChannels.find((c) => c.id === activeChannelId) ?? null;
  const channelMessages = (activeChannelId ? messages[activeChannelId] : undefined) ?? [];

  const handleSelectChannel = (ch: ChatChannel) => {
    setActiveChannel(ch.id);
    clearUnread(ch.id);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    await createChannel(workspaceId, newChannelName.trim());
    const updated = await getChannels(workspaceId);
    setChannels(updated);
    setNewChannelName("");
    setShowNewChannel(false);
  };

  const handleStartDM = async (targetUserId: number) => {
    const dm = await getOrCreateDM(workspaceId, targetUserId);
    await joinChannel(workspaceId, dm.id);
    const updatedDMs = await getDMs(workspaceId);
    setDMs(updatedDMs);
    setActiveChannel(dm.id);
    setShowDMPicker(false);
  };

  const handleSend = () => {
    if (!input.trim() || !activeChannelId) return;
    const socket = getSocket();
    socket?.emit("message:send", { channelId: activeChannelId, content: input.trim() });
    setInput("");
    socket?.emit("typing:stop", { channelId: activeChannelId });
  };

  const handleInputChange = (v: string) => {
    setInput(v);
    if (!user || !activeChannelId) return;
    const socket = getSocket();
    socket?.emit("typing:start", { channelId: activeChannelId, userName: `${user.firstName} ${user.lastName}` });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit("typing:stop", { channelId: activeChannelId });
    }, 2000);
  };

  const handleDeleteMessage = async (msgId: number) => {
    await deleteMessage(workspaceId, msgId);
    if (activeChannelId) {
      setMessages(activeChannelId, channelMessages.filter((m) => m.id !== msgId));
    }
  };

  // Display name for current channel
  const isDM = activeChannel?.type === "DIRECT";
  const otherMember = isDM
    ? activeChannel?.members.find((m) => m.userId !== user?.id)
    : null;
  const displayName = isDM
    ? `${(otherMember as any)?.user?.firstName ?? ""} ${(otherMember as any)?.user?.lastName ?? ""}`.trim()
    : activeChannel?.name ?? "";
  const jitsiRoom = `ezmanage-ws${workspaceId}-ch${activeChannelId}`;
  const jitsiUrl = `https://meet.jit.si/${jitsiRoom}`;

  const filteredMembers = members.filter((m) =>
    `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group messages for rendering
  let lastDate = "";

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-slate-800">Team Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="mb-2">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Channels
              </span>
              <button
                onClick={() => { setShowNewChannel(true); setShowDMPicker(false); }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showNewChannel && (
              <div className="mx-3 mb-1 flex items-center gap-1">
                <span className="text-slate-400">#</span>
                <input
                  autoFocus
                  placeholder="channel-name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateChannel();
                    if (e.key === "Escape") { setShowNewChannel(false); setNewChannelName(""); }
                  }}
                  className="flex-1 rounded border border-indigo-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button onClick={handleCreateChannel} className="text-indigo-500 hover:text-indigo-700">
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setShowNewChannel(false); setNewChannelName(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {channels.map((ch) => {
              const unread = unreadCounts[ch.id] ?? 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors ${
                    activeChannelId === ch.id
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">{ch.name}</span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}

            {channels.length === 0 && !showNewChannel && (
              <p className="px-4 py-1 text-[11px] text-slate-400">No channels yet</p>
            )}
          </div>

          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Direct Messages
              </span>
              <button
                onClick={() => { setShowDMPicker(!showDMPicker); setShowNewChannel(false); }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showDMPicker && (
              <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
                <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
                  <Search className="h-3 w-3 text-slate-400" />
                  <input
                    autoFocus
                    placeholder="Search members…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-xs outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {filteredMembers.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-slate-400">No members found</p>
                  )}
                  {filteredMembers.map((m) => (
                    <button
                      key={m.userId}
                      onClick={() => handleStartDM(m.userId)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">
                          {m.user.firstName[0]}{m.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{m.user.firstName} {m.user.lastName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dms.map((dm) => {
              const other = dm.members.find((m) => m.userId !== user?.id);
              if (!other) return null;
              const otherUser = (other as any).user;
              if (!otherUser) return null;
              const isOnline = onlineUserIds.has(otherUser.id);
              const unread = unreadCounts[dm.id] ?? 0;
              return (
                <button
                  key={dm.id}
                  onClick={() => handleSelectChannel(dm)}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors ${
                    activeChannelId === dm.id
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={otherUser.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {otherUser.firstName[0]}{otherUser.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${isOnline ? "bg-green-500" : "bg-slate-300"}`} />
                  </div>
                  <span className="flex-1 truncate">{otherUser.firstName} {otherUser.lastName}</span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}

            {dms.length === 0 && (
              <p className="px-4 py-1 text-[11px] text-slate-400">No direct messages yet</p>
            )}
          </div>
        </div>

        {/* Online count */}
        <div className="flex items-center gap-1.5 border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5" />
          <span>{onlineUserIds.size} online</span>
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────── */}
      {activeChannel ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Channel Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
            <div className="flex items-center gap-2">
              {isDM && otherMember ? (
                <>
                  <div className="relative">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={(otherMember as any).user?.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(otherMember as any).user?.firstName?.[0]}{(otherMember as any).user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${onlineUserIds.has((otherMember as any).user?.id) ? "bg-green-500" : "bg-slate-300"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                    <p className="text-[10px] text-slate-400">
                      {onlineUserIds.has((otherMember as any).user?.id) ? "Online" : "Offline"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Hash className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                    <p className="text-[10px] text-slate-400">
                      {activeChannel.members.length} members
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Call buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(jitsiUrl, "_blank")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                title="Start video call (Jitsi - free)"
              >
                <Video className="h-3.5 w-3.5" />
                Video Call
              </button>
              <button
                onClick={() => window.open(`https://meet.jit.si/${jitsiRoom}#config.startWithVideoMuted=true`, "_blank")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                title="Start voice call"
              >
                <Phone className="h-3.5 w-3.5" />
                Voice Call
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingMessages && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            )}

            {!loadingMessages && channelMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                  {isDM ? <MessageSquare className="h-6 w-6 text-indigo-400" /> : <Hash className="h-6 w-6 text-indigo-400" />}
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {isDM ? `Start a conversation with ${displayName}` : `Welcome to #${displayName}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">Send your first message below</p>
              </div>
            )}

            {channelMessages.map((msg, i) => {
              const msgDate = formatDate(msg.createdAt);
              const showDate = msgDate !== lastDate;
              if (showDate) lastDate = msgDate;
              const prevMsg = channelMessages[i - 1];
              const isGrouped =
                prevMsg &&
                prevMsg.userId === msg.userId &&
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 120_000;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="shrink-0 rounded-full border border-slate-200 px-3 py-0.5 text-[11px] text-slate-500">
                        {msgDate}
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}

                  <div className={`group flex gap-3 ${isGrouped ? "mt-0.5" : "mt-4"}`}>
                    <div className="w-8 shrink-0 pt-0.5">
                      {!isGrouped && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={msg.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[11px]">
                            {msg.user.firstName[0]}{msg.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800">
                            {msg.user.firstName} {msg.user.lastName}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm leading-relaxed text-slate-700 break-words">{msg.content}</p>
                        {msg.userId === user?.id && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="hidden shrink-0 group-hover:flex items-center text-slate-300 hover:text-red-400 transition-colors mt-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {typingUser && (
              <div className="mt-2 flex items-center gap-2 text-[11px] italic text-slate-400">
                <div className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
                <span>{typingUser} is typing…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <input
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                placeholder={`Message ${isDM ? displayName : `#${displayName}`}`}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition-colors hover:bg-indigo-600 disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Press <kbd className="rounded border border-slate-200 px-1 font-mono">Enter</kbd> to send
            </p>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <MessageSquare className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">Select a channel or conversation</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pick a channel from the sidebar or start a new DM
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
