"use client";

import Link from "next/link";
import { userName, type ChatMessage } from "@/services/work.api";
import { Avatar } from "../primitives";

/** a list of chat messages that link back to their conversation */
export function ChatFeed({ items, ws, empty, badge }: { items: ChatMessage[]; ws: string; empty: string; badge?: (m: ChatMessage) => string | null }) {
  if (!items.length) return <p className="py-14 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id}>
          <Link href={`/work/${ws}/chat/${m.channel?.uid}?${m.parentId ? `thread=${m.parentId}&` : ""}message=${m.id}`} className="flex gap-3 rounded-xl border border-border bg-card p-3.5 hover:bg-accent/30">
            <Avatar user={m.user} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                <strong>{userName(m.user)}</strong>
                <span className="text-muted-foreground">in {m.channel?.kind === "channel" ? `#${m.channel?.name}` : "a direct message"}</span>
                {badge?.(m) && <span className="rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{badge(m)}</span>}
                <span className="ml-auto text-[11.5px] text-muted-foreground">{new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </span>
              {m.title && <span className="mt-0.5 block text-[13.5px] font-semibold">{m.title}</span>}
              <span className="mt-0.5 line-clamp-2 block text-[13.5px]">{m.content || "sent a file"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

