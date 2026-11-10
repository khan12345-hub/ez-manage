"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { workApi } from "@/services/work.api";
import { useWs } from "../../../_components/chat/useChat";
import { ChatFeed } from "../../../_components/chat/ChatFeed";

/** Chat Activity (ClickUp): mentions + replies in my threads, and Saved messages */
export default function ChatActivityPage() {
  const ws = useWs();
  const [tab, setTab] = useState<"activity" | "saved">("activity");
  const { data: act = [] } = useQuery({ queryKey: ["work", "chat-activity", ws], queryFn: () => workApi.chatActivity(ws), enabled: tab === "activity" });
  const { data: saved = [] } = useQuery({ queryKey: ["work", "chat-saved", ws], queryFn: () => workApi.chatSaved(ws), enabled: tab === "saved" });
  return (
    <div className="w-full">
      <header className="border-b border-border bg-card px-6 pt-3">
        <h1 className="text-[15px] font-semibold">Chat Activity</h1>
        <nav role="tablist" aria-label="Chat Activity" className="mt-2 flex gap-1">
          {([["activity", "Mentions & replies"], ["saved", "Saved"]] as const).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-[820px] px-4 py-5">
        {tab === "activity" ? (
          <ChatFeed items={act} ws={ws} empty="No mentions or thread replies yet." badge={(m) => (m.reason === "mention" ? "Mentioned you" : "Replied")} />
        ) : (
          <ChatFeed items={saved} ws={ws} empty="Save messages from their toolbar to find them here." />
        )}
      </div>
    </div>
  );
}
