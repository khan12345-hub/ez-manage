"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, Loader2, Phone, Send, Trash2, Video } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { useAuth } from "@/providers/AuthProvider";
import { getMessages, deleteMessage } from "@/services/chat.api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSocket } from "./ChatProvider";
import type { ChatChannel } from "@/services/chat.api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  channel: ChatChannel;
}

export function ChatWindow({ channel }: Props) {
  const { user } = useAuth();
  const { workspaceId } = useInviteModalStore();
  const { messages, setMessages, activeChannelId, setActiveCall } = useChatStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const channelMessages = messages[channel.id] ?? [];
  const isDM = channel.type === "DIRECT";
  const otherMember = isDM
    ? channel.members.find((m) => m.user && m.userId !== user?.id)
    : null;
  const displayName = isDM
    ? `${otherMember?.user?.firstName ?? ""} ${otherMember?.user?.lastName ?? ""}`
    : `# ${channel.name}`;

  const jitsiRoom = `ezmanage${workspaceId}x${channel.id}`;
  const jitsiHost = process.env.NEXT_PUBLIC_JITSI_HOST ?? "meet.ffmuc.net";
  const jitsiUrl = `https://${jitsiHost}/${jitsiRoom}`;

  // Load messages
  useEffect(() => {
    if (!workspaceId || !activeChannelId) return;
    setLoading(true);
    getMessages(workspaceId, channel.id)
      .then((msgs) => setMessages(channel.id, msgs))
      .finally(() => setLoading(false));

    // Join socket room
    const socket = getSocket();
    socket?.emit("channel:join", { channelId: channel.id });

    // Typing listener
    socket?.on("typing:start", (data: { userId: number; userName: string; channelId: number }) => {
      if (data.channelId === channel.id && data.userId !== user?.id) {
        setTyping(data.userName);
      }
    });
    socket?.on("typing:stop", (data: { channelId: number }) => {
      if (data.channelId === channel.id) setTyping(null);
    });

    return () => {
      socket?.off("typing:start");
      socket?.off("typing:stop");
    };
  }, [channel.id, workspaceId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const socket = getSocket();
    socket?.emit("message:send", { channelId: channel.id, content: input.trim() });
    setInput("");
    // Stop typing indicator
    socket?.emit("typing:stop", { channelId: channel.id });
  };

  const handleInputChange = (v: string) => {
    setInput(v);
    const socket = getSocket();
    if (!user) return;
    socket?.emit("typing:start", {
      channelId: channel.id,
      userName: `${user.firstName} ${user.lastName}`,
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit("typing:stop", { channelId: channel.id });
    }, 2000);
  };

  const handleDelete = async (messageId: number) => {
    if (!workspaceId) return;
    await deleteMessage(workspaceId, messageId);
    setMessages(
      channel.id,
      channelMessages.filter((m) => m.id !== messageId),
    );
  };

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {isDM && otherMember?.user ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={otherMember.user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {otherMember.user.firstName[0]}{otherMember.user.lastName[0]}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-foreground text-sm">{displayName}</span>
        </div>

        {/* Call buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const socket = getSocket();
              setActiveCall({ roomName: jitsiRoom, channelId: channel.id, startWithVideoMuted: false });
              socket?.emit("call:start", {
                channelId: channel.id, callType: "video", jitsiUrl,
                workspaceId, callerName: `${user?.firstName} ${user?.lastName}`, channelName: displayName,
              }, (ack: { callMessageId?: number }) => {
                if (ack?.callMessageId) {
                  setActiveCall({ roomName: jitsiRoom, channelId: channel.id, startWithVideoMuted: false, callMessageId: ack.callMessageId });
                }
              });
            }}
            title="Start video call"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-700 transition-colors"
          >
            <Video className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const socket = getSocket();
              setActiveCall({ roomName: jitsiRoom, channelId: channel.id, startWithVideoMuted: true });
              socket?.emit("call:start", {
                channelId: channel.id, callType: "voice", jitsiUrl,
                workspaceId, callerName: `${user?.firstName} ${user?.lastName}`, channelName: displayName,
              }, (ack: { callMessageId?: number }) => {
                if (ack?.callMessageId) {
                  setActiveCall({ roomName: jitsiRoom, channelId: channel.id, startWithVideoMuted: true, callMessageId: ack.callMessageId });
                }
              });
            }}
            title="Start voice call"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-700 transition-colors"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 120000;

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground shrink-0">{msgDate}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              <div className={`group flex gap-2 ${isGrouped ? "mt-0.5" : "mt-3"}`}>
                <div className="w-7 shrink-0">
                  {!isGrouped && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={msg.user.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {msg.user.firstName[0]}{msg.user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {!isGrouped && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {msg.user.firstName} {msg.user.lastName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-1">
                    <p className="text-sm text-foreground break-words flex-1">{msg.content}</p>
                    {msg.userId === user?.id && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="hidden group-hover:flex items-center text-muted-foreground/50 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <p className="text-[11px] italic text-muted-foreground mt-1">{typing} is typing…</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <input
            className="flex-1 text-sm outline-none placeholder:text-muted-foreground bg-transparent"
            placeholder={`Message ${displayName}`}
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
            className="text-indigo-500 hover:text-indigo-600 disabled:text-muted-foreground transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
