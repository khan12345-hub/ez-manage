"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Hash, MessageSquare, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatStore } from "@/store/chat-store";
import { useAuth } from "@/providers/AuthProvider";
import { getChannels, getDMs } from "@/services/chat.api";
import type { ChatChannel } from "@/services/chat.api";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";
const av = (url?: string | null) => url ? `${BASE_URL}${url}` : undefined;

const MAX_ROWS = 6;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(str: string, n: number) {
  const plain = stripHtml(str);
  return plain.length > n ? plain.slice(0, n) + "…" : plain;
}

interface Props {
  workspaceId: number;
}

export function WorkspaceChannelsCard({ workspaceId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { setActiveChannel, unreadCounts } = useChatStore();

  const { data: channels = [], isLoading: loadingCh } = useQuery({
    queryKey: ["ws-chat-channels", workspaceId],
    queryFn: () => getChannels(workspaceId),
    staleTime: 30_000,
  });

  // DMs are global — fetch separately but keep out of the workspace count
  const { data: dms = [], isLoading: loadingDMs } = useQuery({
    queryKey: ["ws-chat-dms", workspaceId],
    queryFn: () => getDMs(workspaceId),
    staleTime: 30_000,
  });

  const loading = loadingCh || loadingDMs;
  // Only count workspace channels (not global DMs) in hasContent / badge
  const hasContent = channels.length > 0;

  function goToChannel(ch: ChatChannel) {
    setActiveChannel(ch.id);
    router.push(`/workspace/${workspaceId}/chat`);
  }

  function openChat() {
    router.push(`/workspace/${workspaceId}/chat`);
  }

  function dmDisplayName(dm: ChatChannel) {
    const other = dm.members?.find((m) => m.userId !== user?.id);
    return other?.user
      ? `${other.user.firstName} ${other.user.lastName}`
      : "Direct Message";
  }

  function dmAvatar(dm: ChatChannel) {
    const other = dm.members?.find((m) => m.userId !== user?.id);
    return { url: other?.user?.avatarUrl ?? null, initials: other?.user ? `${other.user.firstName[0]}${other.user.lastName[0]}` : "DM" };
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Channels</span>
          </div>
        </div>
        <div className="flex items-center justify-center py-10 text-xs text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (!hasContent) return null;

  const visibleChannels = channels.slice(0, MAX_ROWS);
  const visibleDMs = dms.slice(0, MAX_ROWS);
  const hasDMs = visibleDMs.length > 0;
  const totalUnread = Object.entries(unreadCounts)
    .filter(([id]) => channels.some((c) => c.id === Number(id))) // only workspace channels
    .reduce((s, [, v]) => s + v, 0);

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">

      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
            <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Channels</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {channels.length}
          </span>
          {totalUnread > 0 && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {totalUnread > 99 ? "99+" : totalUnread} new
            </span>
          )}
        </div>
      </div>

      {/* ── Body: 2-col if DMs exist, else single col ─────────────────── */}
      <div className={`grid ${hasDMs ? "grid-cols-2 divide-x divide-slate-100" : "grid-cols-1"}`}>

        {/* Channels column */}
        <div className="flex flex-col">
          {channels.length > 0 && (
            <p className="px-5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Channels
            </p>
          )}
          {visibleChannels.map((ch) => {
            const unread = unreadCounts[ch.id] ?? 0;
            const last = ch.messages?.[0]?.content ?? null;
            return (
              <button
                key={ch.id}
                onClick={() => goToChannel(ch)}
                className="group flex items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  unread > 0
                    ? "bg-indigo-100 group-hover:bg-indigo-200"
                    : "bg-slate-100 group-hover:bg-slate-200"
                }`}>
                  <Hash className={`h-3.5 w-3.5 ${unread > 0 ? "text-indigo-600" : "text-slate-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-600 group-hover:text-slate-800"}`}>
                    {ch.name}
                  </p>
                  {last && (
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {truncate(last, 40)}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
          {channels.length > MAX_ROWS && (
            <button
              onClick={openChat}
              className="px-5 py-2 text-left text-xs text-indigo-500 hover:text-indigo-700 font-medium"
            >
              +{channels.length - MAX_ROWS} more channels…
            </button>
          )}
        </div>

        {/* DMs column */}
        {hasDMs && (
          <div className="flex flex-col">
            <p className="px-5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              My Direct Messages
            </p>
            {visibleDMs.map((dm) => {
              const unread = unreadCounts[dm.id] ?? 0;
              const { url, initials } = dmAvatar(dm);
              const name = dmDisplayName(dm);
              const last = dm.messages?.[0]?.content ?? null;
              return (
                <button
                  key={dm.id}
                  onClick={() => goToChannel(dm)}
                  className="group flex items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={av(url)} />
                    <AvatarFallback className="text-[10px] font-semibold bg-violet-100 text-violet-600">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-600 group-hover:text-slate-800"}`}>
                      {name}
                    </p>
                    {last && (
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                        {truncate(last, 40)}
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
            {dms.length > MAX_ROWS && (
              <button
                onClick={openChat}
                className="px-5 py-2 text-left text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                +{dms.length - MAX_ROWS} more…
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: always-visible CTA to full chat ─────────────────────── */}
      <div className="border-t border-slate-100 px-5 py-3 text-center">
        <button
          onClick={openChat}
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Open Team Chat
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
