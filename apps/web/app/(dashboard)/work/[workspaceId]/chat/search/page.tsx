"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AtSign, Hash, Lock, MessageSquareReply, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, type ChatSearchHit } from "@/services/work.api";
import { Avatar } from "../../../_components/primitives";
import { useDirectory } from "../../../_components/people";
import { useChatSidebar, useWs } from "../../../_components/chat/useChat";

const DATES = [["", "Any time"], ["1", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 3 months"]] as const;
const HAS = [["", "Anything"], ["link", "Links"], ["file", "Files"], ["task", "Tasks"]] as const;
const SELECT = "h-8 rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/50";

/** strip markdown marks so the snippet reads as plain text */
const plain = (t: string) => t.replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_~`>#]/g, "").replace(/\s+/g, " ").trim();

/** a short excerpt around the first match, with every match marked */
function Snippet({ text, q }: { text: string; q: string }) {
  const t = plain(text);
  const term = q.trim();
  if (!term) return <>{t.length > 220 ? `${t.slice(0, 220)}…` : t}</>;
  const at = t.toLowerCase().indexOf(term.toLowerCase());
  const start = at > 80 ? at - 60 : 0;
  const cut = t.slice(start, start + 240);
  const parts = cut.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {start > 0 && "…"}
      {parts.map((p, i) => (p.toLowerCase() === term.toLowerCase() ? <mark key={i} className="rounded-sm bg-[#b08d57]/25 px-0.5 text-foreground">{p}</mark> : <span key={i}>{p}</span>))}
      {start + 240 < t.length && "…"}
    </>
  );
}

function SearchInner() {
  const ws = useWs();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const { data: dir } = useDirectory();
  const { data: side = [] } = useChatSidebar();
  const [text, setText] = useState(sp.get("q") ?? "");
  const f = {
    q: sp.get("q") ?? "", from: sp.get("from") ?? "", in: sp.get("in") ?? "", date: sp.get("date") ?? "",
    has: sp.get("has") ?? "", mentions: sp.get("mentions") === "true", kind: sp.get("kind") ?? "",
  };
  const set = (patch: Record<string, string | null>) => {
    // build from the live URL: a debounced call must not bring back filters cleared meanwhile
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  // typing updates the URL (and so the search) after a short pause
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== f.q) set({ q: text.trim() || null }); }, 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const after = f.date ? new Date(new Date().setHours(0, 0, 0, 0) - (Number(f.date) - 1) * 86_400_000).toISOString() : undefined;
  const filtered = !!(f.from || f.in || f.date || f.has || f.mentions || f.kind);
  const enabled = f.q.length >= 2 || filtered;
  const res = useInfiniteQuery({
    queryKey: ["work", "chat-global-search", ws, f],
    queryFn: ({ pageParam }) => workApi.chatSearch(ws, { q: f.q, from: f.from || undefined, in: f.in || undefined, after, has: f.has || undefined, mentions: f.mentions || undefined, kind: f.kind || undefined, cursor: pageParam || undefined }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!ws && enabled,
  });
  const hits = useMemo(() => res.data?.pages.flatMap((p) => p.items) ?? [], [res.data]);
  const channels = res.data?.pages[0]?.channels ?? [];
  const label = (c: ChatSearchHit["channel"]) => (c.kind === "channel" ? `#${c.name}` : c.people.length ? c.people.map((p) => userName(p)).join(", ") : `${user?.firstName ?? "You"} (you)`);
  const convos = side.map((c) => ({ uid: c.uid, label: c.kind === "channel" ? `#${c.name}` : c.people.length ? c.people.map((p) => userName(p)).join(", ") : "You" }));
  const hrefFor = (m: ChatSearchHit) => (m.parentId ? `/work/${ws}/chat/${m.channel.uid}?thread=${m.parentId}&message=${m.id}` : `/work/${ws}/chat/${m.channel.uid}?message=${m.id}`);

  return (
    <div className="w-full">
      <header className="border-b border-border bg-card px-6 py-3">
        <h1 className="text-[15px] font-semibold">Search chat</h1>
        <p className="text-[12px] text-muted-foreground">Every channel and direct message you can see.</p>
      </header>
      <div className="mx-auto max-w-[860px] px-4 py-5">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary/50">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && set({ q: text.trim() || null })} placeholder="Search messages, posts and threads" aria-label="Search chat" className="w-full bg-transparent text-[14px] outline-none" />
          {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); set({ q: null }); }} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button>}
        </label>

        <div role="group" aria-label="Filters" className="mt-3 flex flex-wrap items-center gap-2">
          <select aria-label="From" value={f.from} onChange={(e) => set({ from: e.target.value || null })} className={SELECT}>
            <option value="">From anyone</option>
            {(dir?.people ?? []).map((p) => <option key={p.user.id} value={p.user.id}>{p.user.id === user?.id ? "Me" : userName(p.user)}</option>)}
          </select>
          <select aria-label="In" value={f.in} onChange={(e) => set({ in: e.target.value || null })} className={cn(SELECT, "max-w-[220px]")}>
            <option value="">In any conversation</option>
            {convos.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
          </select>
          <select aria-label="Date" value={f.date} onChange={(e) => set({ date: e.target.value || null })} className={SELECT}>
            {DATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Has" value={f.has} onChange={(e) => set({ has: e.target.value || null })} className={SELECT}>
            {HAS.map(([v, l]) => <option key={v} value={v}>{v ? `Has ${l.toLowerCase()}` : "Has anything"}</option>)}
          </select>
          <button type="button" aria-pressed={f.mentions} onClick={() => set({ mentions: f.mentions ? null : "true" })} className={cn("flex h-8 items-center gap-1 rounded-md border px-2.5 text-[12.5px]", f.mentions ? "border-primary/50 bg-primary/10 font-medium text-primary" : "border-border hover:bg-accent")}><AtSign className="h-3.5 w-3.5" /> Mentions me</button>
          <button type="button" aria-pressed={f.kind === "post"} onClick={() => set({ kind: f.kind === "post" ? null : "post" })} className={cn("h-8 rounded-md border px-2.5 text-[12.5px]", f.kind === "post" ? "border-primary/50 bg-primary/10 font-medium text-primary" : "border-border hover:bg-accent")}>Posts only</button>
          {filtered && <button type="button" onClick={() => set({ from: null, in: null, date: null, has: null, mentions: null, kind: null })} className="h-8 px-1 text-[12.5px] font-medium text-primary hover:underline">Clear filters</button>}
        </div>

        {!enabled ? (
          <p className="mt-10 text-center text-[13px] text-muted-foreground">Type at least 2 letters, or pick a filter.</p>
        ) : (
          <>
            {channels.length > 0 && (
              <section aria-label="Matching channels" className="mt-5">
                <h2 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</h2>
                <ul className="flex flex-wrap gap-2">
                  {channels.map((c) => (
                    <li key={c.uid}><Link href={`/work/${ws}/chat/${c.uid}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] hover:bg-accent">{c.isPrivate ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}{c.name}<span className="font-mono text-[11px] text-muted-foreground">{c.memberCount}</span>{!c.joined && <span className="text-[11px] text-muted-foreground">· not joined</span>}</Link></li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Messages" className="mt-5">
              <h2 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Messages</h2>
              {res.isLoading ? (
                <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
              ) : !hits.length ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">No messages match{f.q ? ` “${f.q}”` : ""}.</p>
              ) : (
                <ul aria-label="Search results" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {hits.map((m) => (
                    <li key={m.id}>
                      <Link href={hrefFor(m)} className="flex gap-3 px-4 py-3 hover:bg-accent/50">
                        <Avatar user={m.user} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                            <strong className="text-[13px] text-foreground">{userName(m.user)}</strong>
                            <span className="flex items-center gap-1">{m.channel.kind === "channel" ? (m.channel.isPrivate ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />) : <Users className="h-3 w-3" />}{label(m.channel).replace(/^#/, "")}</span>
                            {m.parentId && <span className="flex items-center gap-1"><MessageSquareReply className="h-3 w-3" /> in a thread</span>}
                            {m.kind === "post" && <span className="rounded bg-primary/10 px-1.5 text-[10.5px] font-semibold uppercase text-primary">Post</span>}
                            <time dateTime={m.createdAt} className="ml-auto font-mono text-[11px]">{new Date(m.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
                          </p>
                          {m.title && <p className="mt-0.5 text-[13.5px] font-semibold"><Snippet text={m.title} q={f.q} /></p>}
                          <p className="mt-0.5 text-[13.5px] leading-snug text-foreground/90"><Snippet text={m.content} q={f.q} /></p>
                          {(m.files?.length ?? 0) > 0 && <p className="mt-1 text-[11.5px] text-muted-foreground">📎 {m.files.map((x) => x.name).join(", ")}</p>}
                          {m.task && <p className="mt-1 text-[11.5px] text-muted-foreground">Task: {m.task.name}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {res.hasNextPage && (
                <div className="mt-3 flex justify-center">
                  <button type="button" disabled={res.isFetchingNextPage} onClick={() => res.fetchNextPage()} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50">{res.isFetchingNextPage ? "Loading…" : "Load more"}</button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatSearchPage() {
  return <Suspense fallback={null}><SearchInner /></Suspense>;
}
