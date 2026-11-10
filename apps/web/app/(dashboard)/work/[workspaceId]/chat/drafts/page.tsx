"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { workApi } from "@/services/work.api";
import { useWs } from "../../../_components/chat/useChat";
import { ChatFeed } from "../../../_components/chat/ChatFeed";

/** Drafts & Sent (ClickUp): unsent drafts per conversation, scheduled (soon), sent messages */
export default function DraftsSentPage() {
  const ws = useWs();
  const [tab, setTab] = useState<"drafts" | "scheduled" | "sent">("drafts");
  const { data: drafts = [] } = useQuery({ queryKey: ["work", "chat-drafts", ws], queryFn: () => workApi.chatDrafts(ws), enabled: tab === "drafts" });
  const { data: sent = [] } = useQuery({ queryKey: ["work", "chat-sent", ws], queryFn: () => workApi.chatSent(ws), enabled: tab === "sent" });
  return (
    <div className="w-full">
      <header className="border-b border-border bg-card px-6 pt-3">
        <h1 className="text-[15px] font-semibold">Drafts &amp; Sent</h1>
        <nav role="tablist" aria-label="Drafts & Sent" className="mt-2 flex gap-1">
          {([["drafts", "Drafts"], ["scheduled", "Scheduled"], ["sent", "Sent"]] as const).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-[820px] px-4 py-5">
        {tab === "drafts" &&
          (drafts.length ? (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={`${d.channel.uid}-${d.parentId}`}>
                  <Link href={`/work/${ws}/chat/${d.channel.uid}${d.parentId ? `?thread=${d.parentId}` : ""}`} className="flex gap-3 rounded-xl border border-border bg-card p-3.5 hover:bg-accent/30">
                    <Pencil className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-muted-foreground">{d.channel.kind === "channel" ? `#${d.channel.name}` : "Direct message"}{d.parentId ? " · thread" : ""} · {new Date(d.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[13.5px]">{d.content}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-14 text-center text-[13px] text-muted-foreground">You have no drafts.</p>
          ))}
        {tab === "scheduled" && <p className="py-14 text-center text-[13px] text-muted-foreground">Scheduled messages are coming soon.</p>}
        {tab === "sent" && <ChatFeed items={sent} ws={ws} empty="Messages you send show up here." />}
      </div>
    </div>
  );
}
