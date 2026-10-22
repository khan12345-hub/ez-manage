"use client";

import { useState } from "react";
import { Hash, Search, X, Share2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendChatMessage } from "@/components/Chat/ChatProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useChatStore } from "@/store/chat-store";
import type { ChatMessage } from "@/services/chat.api";
import { resolveUrl } from "@/lib/resolveUrl";

interface Props {
  message: ChatMessage;
  onClose: () => void;
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? d.innerText ?? html).trim();
}

export function ForwardMessageModal({ message, onClose }: Props) {
  const { user } = useAuth();
  const { channels, dms } = useChatStore();
  const [search, setSearch] = useState("");
  const [sentId, setSentId] = useState<number | null>(null);

  function handleForward(targetChannelId: number) {
    if (sentId) return;
    const senderName = `${message.user.firstName} ${message.user.lastName}`;
    const originalText = stripHtml(message.content ?? "");
    const truncated = originalText.length > 200 ? originalText.slice(0, 200) + "…" : originalText;
    const forwardedContent = `<p><em>Forwarded from <strong>${senderName}</strong>:</em></p><blockquote><p>${truncated}</p></blockquote>`;
    sendChatMessage({ channelId: targetChannelId, content: forwardedContent });
    setSentId(targetChannelId);
    setTimeout(onClose, 900);
  }

  const allItems = [
    ...channels.map((c) => ({
      id: c.id,
      label: c.name ?? "channel",
      type: "channel" as const,
      avatar: null as string | null | undefined,
    })),
    ...dms.map((d) => {
      const other = d.members.find((m) => m.userId !== user?.id);
      const label = other?.user
        ? `${other.user.firstName} ${other.user.lastName}`
        : "Direct message";
      return { id: d.id, label, type: "dm" as const, avatar: other?.user?.avatarUrl };
    }),
  ];

  const filtered = allItems.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase()),
  );

  const preview = stripHtml(message.content ?? "").slice(0, 80);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold">Forward message</span>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Message preview */}
        <div className="mx-4 mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {message.user.firstName} {message.user.lastName}
          </p>
          <p className="mt-0.5 truncate text-xs text-foreground">
            {preview}{preview.length >= 80 ? "…" : ""}
          </p>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels or people…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-52 overflow-y-auto p-2 mt-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No results</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => handleForward(item.id)}
              disabled={!!sentId}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted disabled:opacity-60"
            >
              {item.type === "channel" ? (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600">
                  <Hash className="h-3 w-3" />
                </div>
              ) : (
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage
                    src={item.avatar ? resolveUrl(item.avatar) : undefined}
                  />
                  <AvatarFallback className="text-[9px]">
                    {item.label[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {sentId === item.id && (
                <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
