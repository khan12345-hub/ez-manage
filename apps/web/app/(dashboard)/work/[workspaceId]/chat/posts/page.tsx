"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi } from "@/services/work.api";
import { Avatar } from "../../../_components/primitives";
import { useDirectory } from "../../../_components/people";
import { RichText } from "../../../_components/chat/ChatMessages";
import { POST_TYPES, useChatSidebar, useWs } from "../../../_components/chat/useChat";

/** Posts (ClickUp): write a post to a channel; feed of posts across channels with type filter */
export default function PostsPage() {
  const ws = useWs();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: dir } = useDirectory();
  const { data: side = [] } = useChatSidebar();
  const [type, setType] = useState<string>("");
  const { data: posts = [] } = useQuery({ queryKey: ["work", "chat-posts", ws, type], queryFn: () => workApi.chatPosts(ws, type || undefined) });
  const channels = side.filter((c) => c.kind === "channel" && c.joined);
  const [channel, setChannel] = useState("");
  const [postType, setPostType] = useState("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const members = useMemo(() => (dir?.people ?? []).map((p) => p.user), [dir]);
  const send = useMutation({
    mutationFn: () => workApi.sendChat(channel, { kind: "post", title: title.trim(), postType, content: body.trim() }),
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["work", "chat-posts", ws] }); toast.success("Posted"); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't post."),
  });

  return (
    <div className="w-full">
      <header className="border-b border-border bg-card px-6 py-3"><h1 className="text-[15px] font-semibold">Posts</h1></header>
      <div className="mx-auto max-w-[780px] px-4 py-6">
        <section aria-label="New post" className="flex gap-3">
          {user && <Avatar user={user as any} size={36} />}
          <div className="flex-1 rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-[13px]">
              <span className="text-muted-foreground">Channel:</span>
              <select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-[12.5px]">
                <option value="">Select Channel</option>
                {channels.map((c) => <option key={c.uid} value={c.uid}>#{c.name}</option>)}
              </select>
              <span className="ml-2 text-muted-foreground">Type:</span>
              <select aria-label="Type" value={postType} onChange={(e) => setPostType(e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-[12.5px]">
                {POST_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" maxLength={200} className="w-full border-b border-border bg-transparent px-4 py-2.5 text-[15px] font-semibold outline-none" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share an update…" aria-label="Post body" rows={3} className="block w-full resize-none bg-transparent px-4 py-2.5 text-[13.5px] outline-none [field-sizing:content]" />
            <div className="flex justify-end px-3 pb-3">
              <button type="button" disabled={!channel || !title.trim() || !body.trim() || send.isPending} onClick={() => send.mutate()} className="h-8 rounded-lg bg-forest px-4 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Post</button>
            </div>
          </div>
        </section>

        <div role="tablist" aria-label="Post type" className="mt-6 flex flex-wrap gap-1.5">
          {[{ id: "", label: "All" }, ...POST_TYPES].map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={type === p.id} onClick={() => setType(p.id)} className={cn("rounded-full border px-3 py-1 text-[12.5px]", type === p.id ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:bg-accent")}>{p.label}</button>
          ))}
        </div>

        <ul aria-label="Posts feed" className="mt-4 space-y-4">
          {posts.map((m) => {
            const t = POST_TYPES.find((p) => p.id === m.postType) ?? POST_TYPES[0];
            return (
              <li key={m.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2.5">
                  <Avatar user={m.user} size={32} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">{userName(m.user)}</span>
                    <span className="block text-[11.5px] text-muted-foreground">in #{m.channel?.name} · {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · <span style={{ color: t.color }}>{t.label}</span></span>
                  </span>
                </div>
                <h2 className="mt-3 text-[18px] font-semibold">{m.title}</h2>
                <div className="mt-1 text-[13.5px] leading-relaxed"><RichText text={m.content} members={members} /></div>
                <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
                  {m.reactions.map((r) => <span key={r.emoji} className="rounded-full border border-border px-2 py-0.5">{r.emoji} {r.userIds.length}</span>)}
                  <span className="flex-1" />
                  <Link href={`/work/${ws}/chat/${m.channel?.uid}?thread=${m.id}`} className="flex items-center gap-1 font-medium text-primary hover:underline"><MessageSquareReply className="h-3.5 w-3.5" /> {m.replyCount ? `${m.replyCount} ${m.replyCount === 1 ? "reply" : "replies"}` : "Reply"}</Link>
                </div>
              </li>
            );
          })}
          {!posts.length && <li className="py-12 text-center text-[13px] text-muted-foreground">No posts yet. Announcements, discussions, ideas and updates show up here.</li>}
        </ul>
      </div>
    </div>
  );
}
