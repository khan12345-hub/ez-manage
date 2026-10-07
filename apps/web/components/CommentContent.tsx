"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllChatUsers, getOrCreateDM } from "@/services/chat.api";
import { useChatStore } from "@/store/chat-store";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";

interface HoverState {
  userId: number;
  x: number;
  y: number;
}

interface Props {
  html: string;
}

export function CommentContent({ html }: Props) {
  const params = useParams();
  const workspaceId = Number(params?.workspaceId);
  const router = useRouter();
  const { onlineUserIds, setActiveChannel } = useChatStore();

  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["chat-users-for-mentions", workspaceId],
    queryFn: () => getAllChatUsers(workspaceId),
    enabled: !!workspaceId,
    staleTime: 300_000,
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onOver = (e: MouseEvent) => {
      const span = (e.target as HTMLElement).closest(
        '[data-type="mention"]',
      ) as HTMLElement | null;
      if (!span) return;
      const userId = Number(span.dataset.id);
      if (!userId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const rect = span.getBoundingClientRect();
      setHover({ userId, x: rect.left, y: rect.bottom + 10 });
    };

    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest("[data-mention-card]")) return;
      timerRef.current = setTimeout(() => setHover(null), 180);
    };

    el.addEventListener("mouseover", onOver);
    el.addEventListener("mouseout", onOut);
    return () => {
      el.removeEventListener("mouseover", onOver);
      el.removeEventListener("mouseout", onOut);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const mentionUser = hover
    ? users.find((u) => u.userId === hover.userId)
    : null;
  const isOnline = hover ? onlineUserIds.has(hover.userId) : false;

  async function handleChat() {
    if (!hover || !workspaceId) return;
    setChatLoading(true);
    try {
      const dm = await getOrCreateDM(workspaceId, hover.userId);
      setActiveChannel(dm.id);
      router.push(`/workspace/${workspaceId}/chat`);
    } catch {}
    setChatLoading(false);
    setHover(null);
  }

  return (
    <>
      <div ref={wrapRef} className="prose prose-sm max-w-none app-comment-box">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {hover &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            data-mention-card
            style={{
              position: "fixed",
              left: Math.min(hover.x, window.innerWidth - 248),
              top: Math.min(hover.y, window.innerHeight - 160),
              zIndex: 9999,
            }}
            onMouseEnter={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
            }}
            onMouseLeave={() => {
              timerRef.current = setTimeout(() => setHover(null), 180);
            }}
            className="w-60 overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          >
            {/* Header strip */}
            <div className="h-10 bg-gradient-to-r from-indigo-500 to-violet-500" />

            {/* Avatar + info */}
            <div className="-mt-6 flex flex-col items-center px-4 pb-3 text-center">
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-white">
                  <AvatarImage
                    src={
                      mentionUser?.user.avatarUrl
                        ? `${BASE_URL}${mentionUser.user.avatarUrl}`
                        : undefined
                    }
                  />
                  <AvatarFallback className="bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {mentionUser?.user.firstName?.[0]}
                    {mentionUser?.user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                    isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                  }`}
                />
              </div>

              <p className="mt-2 text-sm font-semibold text-foreground leading-tight">
                {mentionUser
                  ? `${mentionUser.user.firstName} ${mentionUser.user.lastName}`
                  : `User #${hover.userId}`}
              </p>
              <p
                className={`text-[11px] font-medium ${
                  isOnline ? "text-green-500" : "text-muted-foreground"
                }`}
              >
                {isOnline ? "● Online" : "○ Offline"}
              </p>
              {mentionUser?.user.email && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {mentionUser.user.email}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-border p-2.5">
              <button
                onClick={handleChat}
                disabled={chatLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {chatLoading ? "…" : "Chat"}
              </button>
              <button
                onClick={() => {
                  router.push(
                    `/workspace/${workspaceId}/chat`,
                  );
                  setHover(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                Profile
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
