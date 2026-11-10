"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Lock, Search } from "lucide-react";
import { workApi } from "@/services/work.api";
import { CreateChannelDialog } from "../../../_components/chat/ChatSidebar";
import { chatSidebarKey, useChatSidebar, useWs } from "../../../_components/chat/useChat";

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

/** All Channels (ClickUp): search, topic, members, last updated, join */
export default function AllChannelsPage() {
  const ws = useWs();
  const qc = useQueryClient();
  const { data = [] } = useChatSidebar();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const join = useMutation({ mutationFn: (uid: string) => workApi.joinChannel(uid), onSuccess: () => qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }) });
  const leave = useMutation({ mutationFn: (uid: string) => workApi.leaveChannel(uid), onSuccess: () => qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }) });
  const rows = data.filter((c) => c.kind === "channel" && (!q.trim() || `${c.name} ${c.topic ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="w-full">
      <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <h1 className="text-[15px] font-semibold">All Channels</h1>
        <span className="flex-1" />
        <button type="button" onClick={() => setCreating(true)} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Create Channel</button>
      </header>
      <div className="px-6 py-4">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for Channels" aria-label="Search for Channels" className="w-full bg-transparent text-[13.5px] outline-none" /></label>
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
              <th className="py-2 pl-2 font-medium">Channels</th><th className="py-2 font-medium">Topic</th><th className="w-24 py-2 font-medium">Members</th><th className="w-32 py-2 font-medium">Last updated</th><th className="w-28 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.uid} className="border-b border-border/60 hover:bg-accent/30">
                <td className="py-2.5 pl-2">
                  <Link href={`/work/${ws}/chat/${c.uid}`} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"><Hash className="h-4 w-4 text-muted-foreground" /></span>
                    <span><span className="flex items-center gap-1 font-semibold">{c.name}{c.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}</span><span className="block text-[11.5px] text-muted-foreground">{c.description || (c.locationType ? `in a ${c.locationType}` : "in Workspace")}</span></span>
                  </Link>
                </td>
                <td className="text-muted-foreground">{c.topic ?? ""}</td>
                <td>{c.memberCount}</td>
                <td className="text-muted-foreground">{ago(c.lastMessageAt)}</td>
                <td className="pr-2 text-right">
                  {c.joined ? (
                    <button type="button" onClick={() => leave.mutate(c.uid)} className="group/f h-7 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-accent"><span className="group-hover/f:hidden">Following</span><span className="hidden group-hover/f:inline">Leave</span></button>
                  ) : (
                    <button type="button" onClick={() => join.mutate(c.uid)} className="h-7 rounded-md border border-border px-2.5 text-[12px] font-medium hover:bg-accent">Join</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">{q ? "No channels match." : "No channels yet — create the first one."}</td></tr>}
          </tbody>
        </table>
      </div>
      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
