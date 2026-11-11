"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Bell, Bookmark, CalendarDays, Columns3, List, ListChecks, BellOff, Hash, Lock, LogOut, MessageSquareReply, MoreHorizontal, Paperclip, Pin, Search, Settings2, Star, UserPlus, Users, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, type ChatChannelDetail, type ChatMessage, type WorkUser } from "@/services/work.api";
import { Avatar } from "../primitives";
import { OnlineDot, useDirectory, useProfilePanel } from "../people";
import { ChatComposer } from "./ChatComposer";
import { useShareChannel } from "./ShareChannel";
import { MessageList, MessageRow } from "./ChatMessages";
import { ScheduledBanner } from "./Scheduled";
import { FilesPanel } from "./ChatFiles";
import { BookmarkDialog, BookmarksBar } from "./Bookmarks";
import { DmCalendar, DmTasks } from "./DmTabs";
import { LocIcon, LocationBoard, LocationCalendar, LocationList, locationHref } from "./LocationChannel";
import { ChannelViewPanel, ChannelViewTabs, channelViewsKey, useChannelViews } from "./ChannelViews";
import { channelKey, chatSidebarKey, messagesKey, threadKey, useChannelMessages, useChatEvents, useWs } from "./useChat";

type Panel = "members" | "search" | "threads" | "pinned" | "files" | "settings" | null;

export function channelTitle(c: { kind: string; name: string | null }, people: WorkUser[] = []) {
  return c.kind === "channel" ? c.name ?? "channel" : people.map((p) => userName(p)).join(", ") || "Just you";
}

export function ChannelView({ uid }: { uid: string }) {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const openProfile = useProfilePanel((s) => s.open);
  const openShare = useShareChannel((s) => s.open);
  const thread = Number(sp.get("thread")) || null;
  const focus = Number(sp.get("message")) || null;
  const [panel, setPanel] = useState<Panel>(null);
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [typing, setTyping] = useState<Record<number, { name: string; at: number }>>({});
  const { data: ch, isError } = useQuery({ queryKey: channelKey(uid), queryFn: () => workApi.channel(uid), retry: false });
  const { data: page } = useChannelMessages(uid);
  const { data: views = [] } = useChannelViews(uid);
  const tabId = Number(sp.get("tab")) || null;
  const activeView = views.find((v) => v.id === tabId) ?? null;
  const rawTab = sp.get("tab");
  const { data: dir } = useDirectory();
  const { data: drafts = [] } = useQuery({ queryKey: ["work", "chat-drafts", ws], queryFn: () => workApi.chatDrafts(ws), staleTime: 30_000 });
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => { setOlder([]); setHasMore(!!page?.hasMore); }, [uid, page?.hasMore]);
  const items = useMemo(() => [...older, ...(page?.items ?? [])], [older, page?.items]);
  const members: WorkUser[] = useMemo(() => (dir?.people ?? []).map((p) => p.user), [dir]);
  const others = (ch?.members ?? []).map((m) => m.user).filter((u) => u.id !== user?.id);
  const draft = drafts.find((d) => d.channel.uid === uid && !d.parentId)?.content ?? "";

  // mark read when opened and when new messages arrive while looking
  const lastId = page?.items[page.items.length - 1]?.id;
  useEffect(() => {
    if (!ch?.joined) return;
    workApi.readChannel(uid).then(() => qc.invalidateQueries({ queryKey: chatSidebarKey(ws) })).catch(() => {});
  }, [uid, lastId, ch?.joined, qc, ws]);

  useChatEvents((e) => {
    if (e.channelUid !== uid) return;
    if (e.type === "views") { qc.invalidateQueries({ queryKey: channelViewsKey(uid) }); return; }
    if (e.type === "typing" && e.userId) setTyping((t) => ({ ...t, [e.userId!]: { name: e.name ?? "", at: Date.now() } }));
    if (e.type === "message" && e.message?.user?.id) setTyping((t) => { const n = { ...t }; delete n[e.message.user.id]; return n; });
    if (e.type === "channel") {
      if (e.archived || e.removed) { toast.message("This channel is no longer available."); router.push(`/work/${ws}/chat/channels`); return; }
      qc.invalidateQueries({ queryKey: channelKey(uid) });
    }
  });
  useEffect(() => {
    const t = setInterval(() => setTyping((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => Date.now() - v.at < 6000))), 2000);
    return () => clearInterval(t);
  }, []);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v); else next.delete(k);
    next.delete("message");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const join = useMutation({ mutationFn: () => workApi.joinChannel(uid), onSuccess: () => { qc.invalidateQueries({ queryKey: channelKey(uid) }); qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); qc.invalidateQueries({ queryKey: messagesKey(uid) }); } });
  const prefs = useMutation({ mutationFn: (b: { muted?: boolean; starred?: boolean }) => workApi.channelPrefs(uid, b), onSuccess: () => { qc.invalidateQueries({ queryKey: channelKey(uid) }); qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); } });
  const leave = useMutation({ mutationFn: () => workApi.leaveChannel(uid), onSuccess: () => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); router.push(`/work/${ws}/chat/channels`); } });
  const loadOlder = async () => {
    const first = items[0];
    if (!first) return;
    const r = await workApi.chatMessages(uid, { before: first.createdAt });
    setOlder((o) => [...r.items, ...o]);
    setHasMore(r.hasMore);
  };

  if (isError) return <div className="flex h-full items-center justify-center p-10 text-[13.5px] text-muted-foreground">This channel doesn&apos;t exist, was archived, or you don&apos;t have access.</div>;
  if (!ch) return <div className="p-8"><div className="h-24 animate-pulse rounded-xl bg-muted" /></div>;

  const isDm = ch.kind !== "channel";
  const canEditViews = ch.canManage || ["full", "edit"].includes(ch.myPermission ?? "");
  const dmTab = isDm && (rawTab === "tasks" || rawTab === "calendar") ? rawTab : null;
  const loc = ch.location && !ch.location.locked ? ch.location : null;
  const locTab = loc && (rawTab === "list" || rawTab === "board" || rawTab === "calendar") ? rawTab : null;
  const builtins = isDm
    ? [{ id: "tasks", label: "Tasks", icon: ListChecks }, { id: "calendar", label: "Calendar", icon: CalendarDays }]
    : loc ? [{ id: "list", label: "List", icon: List }, { id: "board", label: "Board", icon: Columns3 }, { id: "calendar", label: "Calendar", icon: CalendarDays }] : [];
  const title = channelTitle(ch, others);
  const typers = Object.values(typing).map((t) => t.name).filter(Boolean);
  const railBtn = (id: Exclude<Panel, null>, label: string, Icon: typeof Users, badge?: number) => (
    <button type="button" aria-label={label} title={label} aria-pressed={panel === id} onClick={() => setPanel(panel === id ? null : id)} className={cn("relative flex h-8 w-8 items-center justify-center rounded-md", panel === id ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      <Icon className="h-4 w-4" />
      {!!badge && <span className="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-muted px-1 text-center font-mono text-[9px] leading-[14px]">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-card px-5 py-2.5">
        {isDm ? (
          others.length === 1 ? (
            <button type="button" onClick={() => openProfile(others[0]!.id)} className="flex items-center gap-2">
              <span className="relative"><Avatar user={others[0]!} size={26} /><OnlineDot online={dir?.people.find((p) => p.user.id === others[0]!.id)?.online} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" /></span>
              <h1 className="text-[15px] font-semibold">{title}</h1>
            </button>
          ) : (
            <h1 className="flex items-center gap-2 text-[15px] font-semibold"><Users className="h-4 w-4 text-muted-foreground" /> {title}</h1>
          )
        ) : (
          <h1 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
            {loc && (
              <nav aria-label="Location" className="flex min-w-0 items-center gap-1 text-[13px] font-normal text-muted-foreground">
                {loc.type !== "space" && <><Link href={locationHref(ws, { type: "space", uid: loc.space.uid })} className="truncate hover:text-foreground hover:underline">{loc.space.name}</Link><span aria-hidden>/</span></>}
                <Link href={locationHref(ws, loc)} className="flex min-w-0 items-center gap-1 font-medium text-foreground/80 hover:text-foreground hover:underline"><LocIcon type={loc.type} /> <span className="truncate">{loc.name}</span></Link>
                <span aria-hidden>/</span>
              </nav>
            )}
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" /> <span className="truncate">{ch.name}</span>
            {ch.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private" />}
          </h1>
        )}
        <button type="button" aria-label={ch.starred ? "Remove from favourites" : "Add to favourites"} onClick={() => ch.joined && prefs.mutate({ starred: !ch.starred })} className="rounded p-1 text-muted-foreground hover:bg-accent"><Star className={cn("h-4 w-4", ch.starred && "fill-[#b08d57] text-[#b08d57]")} /></button>
        {ch.topic && <span className="hidden truncate text-[12.5px] text-muted-foreground md:inline">· {ch.topic}</span>}
        <span className="flex-1" />
        {!isDm && (
          <button type="button" onClick={() => openShare(uid)} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12.5px] hover:bg-accent">
            {ch.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />} Share · {ch.members.length}
          </button>
        )}
        {isDm && others.length === 1 && <button type="button" onClick={() => openProfile(others[0]!.id)} className="rounded-md border border-border px-2.5 py-1 text-[12.5px] hover:bg-accent">Show profile</button>}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild><button type="button" aria-label="Channel options" className="rounded p-1 text-muted-foreground hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {ch.joined && <DropdownMenuItem onClick={() => prefs.mutate({ muted: !ch.muted })}>{ch.muted ? <><Bell className="mr-2 h-4 w-4" /> Unmute</> : <><BellOff className="mr-2 h-4 w-4" /> Mute notifications</>}</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href.split("?")[0]!).then(() => toast.success("Link copied"))}>Copy link</DropdownMenuItem>
            {!isDm && <DropdownMenuItem onClick={() => setPanel("settings")}><Settings2 className="mr-2 h-4 w-4" /> Channel settings</DropdownMenuItem>}
            {!isDm && <DropdownMenuItem onClick={() => openShare(uid)}><Users className="mr-2 h-4 w-4" /> Sharing &amp; Permissions</DropdownMenuItem>}
            {canEditViews && ch.joined && <DropdownMenuItem onClick={() => setAddingBookmark(true)}><Bookmark className="mr-2 h-4 w-4" /> Add bookmark</DropdownMenuItem>}
            {!isDm && ch.joined && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => leave.mutate()}><LogOut className="mr-2 h-4 w-4" /> Leave channel</DropdownMenuItem></>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <BookmarksBar uid={uid} canEdit={canEditViews && ch.joined} onAdd={() => setAddingBookmark(true)} />
      {addingBookmark && <BookmarkDialog uid={uid} onClose={() => setAddingBookmark(false)} />}
      {(builtins.length > 0 || views.length > 0 || (canEditViews && ch.joined)) && <ChannelViewTabs uid={uid} views={views} active={dmTab ?? locTab ?? activeView?.id ?? null} canEdit={canEditViews && ch.joined} onSelect={(id) => setParam("tab", id ? String(id) : null)} builtins={builtins} />}

      {locTab ? (
        <div className="flex min-h-0 flex-1 flex-col">{locTab === "list" ? <LocationList uid={uid} /> : locTab === "board" ? <LocationBoard uid={uid} /> : <LocationCalendar uid={uid} />}</div>
      ) : dmTab ? (
        <div className="flex min-h-0 flex-1 flex-col">{dmTab === "tasks" ? <DmTasks uid={uid} others={others} /> : <DmCalendar uid={uid} others={others} />}</div>
      ) : activeView ? (
        <div className="flex min-h-0 flex-1 flex-col"><ChannelViewPanel uid={uid} view={activeView} canEdit={canEditViews && ch.joined} members={members} /></div>
      ) : (
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <MessageList
            items={items}
            members={members}
            me={user?.id}
            channelUid={uid}
            focusId={focus}
            hasMore={hasMore}
            onLoadOlder={loadOlder}
            onOpenThread={(id) => setParam("thread", String(id))}
            emptyText={
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">{isDm ? <Users className="h-6 w-6 text-primary" /> : <Hash className="h-6 w-6 text-primary" />}</span>
                <h2 className="mt-3 text-[16px] font-semibold">{isDm ? `This is the start of your conversation with ${title}` : `Welcome to #${ch.name}`}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{ch.description || (isDm ? "Messages here are only visible to the people in this conversation." : "Share updates, ask questions and keep the team in sync.")}</p>
              </div>
            }
          />
          <div className="h-5 px-6 text-[12px] text-muted-foreground" aria-live="polite">{typers.length ? `${typers.join(", ")} ${typers.length === 1 ? "is" : "are"} typing…` : ""}</div>
          {ch.joined || ch.kind === "channel" ? (
            !ch.joined && !ch.isPrivate ? (
              <div className="mx-4 mb-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <span className="text-[13px]">You&apos;re viewing <strong>#{ch.name}</strong>. Join to send messages and get notifications.</span>
                <button type="button" onClick={() => join.mutate()} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Join channel</button>
              </div>
            ) : !ch.canPost ? (
              <p className="mx-4 mb-4 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-center text-[13px] text-muted-foreground">You have <strong>View only</strong> access to this channel.</p>
            ) : (
              <>
              <ScheduledBanner channelUid={uid} />
              <ChatComposer channelUid={uid} members={members} placeholder={`Write to ${isDm ? title : `#${ch.name}`}`} initialDraft={draft} allowPost={!isDm && ["full", "edit"].includes(ch.myPermission ?? "edit")} />
              </>
            )
          ) : null}
        </div>

        {thread && <ThreadPanel uid={uid} id={thread} members={members} onClose={() => setParam("thread", null)} />}
        {!thread && panel && <SidePanel panel={panel} ch={ch} uid={uid} members={members} onOpenThread={(id) => setParam("thread", String(id))} onClose={() => setPanel(null)} />}

        <nav aria-label="Channel panels" className="flex shrink-0 flex-col items-center gap-1 border-l border-border bg-card px-1.5 py-2">
          {!isDm && railBtn("members", "Members", Users, ch.members.length)}
          {railBtn("search", "Search messages", Search)}
          {railBtn("threads", "Threads", MessageSquareReply)}
          {railBtn("pinned", "Pinned", Pin, ch.pinned.length)}
          {railBtn("files", "Files", Paperclip)}
          {!isDm && railBtn("settings", "Channel settings", Settings2)}
        </nav>
      </div>
      )}
    </div>
  );
}

function ThreadPanel({ uid, id, members, onClose }: { uid: string; id: number; members: WorkUser[]; onClose: () => void }) {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: threadKey(id), queryFn: () => workApi.chatThread(id) });
  return (
    <aside aria-label="Thread" className="flex w-[400px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="flex-1 text-[14px] font-semibold">{data ? `${data.parent.user.firstName}'s Thread` : "Thread"}</h2>
        <button type="button" aria-label="Close thread" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {data && (
          <ul aria-label="Thread messages">
            <MessageRow m={data.parent} grouped={false} members={members} me={user?.id} channelUid={uid} inThread />
            <li aria-hidden className="flex items-center gap-3 px-6 py-2 text-[11.5px] text-muted-foreground">
              <span>{data.replies.length ? `${data.replies.length} ${data.replies.length === 1 ? "reply" : "replies"}` : "No replies"}</span><span className="h-px flex-1 bg-border" />
            </li>
            {data.replies.map((r, i) => <MessageRow key={r.id} m={r} grouped={i > 0 && data.replies[i - 1]!.user.id === r.user.id} members={members} me={user?.id} channelUid={uid} inThread />)}
          </ul>
        )}
      </div>
      <ChatComposer channelUid={uid} members={members} placeholder="Reply…" parentId={id} allowPost={false} />
    </aside>
  );
}

function SidePanel({ panel, ch, uid, members, onOpenThread, onClose }: { panel: Exclude<Panel, null>; ch: ChatChannelDetail; uid: string; members: WorkUser[]; onOpenThread: (id: number) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const ws = useWs();
  const { user } = useAuth();
  const openProfile = useProfilePanel((s) => s.open);
  const [q, setQ] = useState("");
  const [name, setName] = useState(ch.name ?? "");
  const [topic, setTopic] = useState(ch.topic ?? "");
  const [desc, setDesc] = useState(ch.description ?? "");
  const [adding, setAdding] = useState(false);
  const { data: found } = useQuery({ queryKey: ["work", "chat-search", uid, q], queryFn: () => workApi.chatMessages(uid, { q }), enabled: panel === "search" && q.trim().length > 1 });
  const { data: threads } = useQuery({ queryKey: ["work", "chat-threads", uid], queryFn: () => workApi.chatMessages(uid), enabled: panel === "threads" });
  const save = useMutation({ mutationFn: () => workApi.updateChannel(uid, { name, topic: topic || null, description: desc || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: channelKey(uid) }); qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); toast.success("Channel saved"); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't save.") });
  const archive = useMutation({ mutationFn: () => workApi.archiveChannel(uid), onSuccess: () => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); router.push(`/work/${ws}/chat/channels`); } });
  const add = useMutation({ mutationFn: (id: number) => workApi.addChannelMembers(uid, [id]), onSuccess: () => qc.invalidateQueries({ queryKey: channelKey(uid) }), onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't add.") });
  const removeM = useMutation({ mutationFn: (id: number) => workApi.removeChannelMember(uid, id), onSuccess: () => qc.invalidateQueries({ queryKey: channelKey(uid) }) });
  const titles: Record<string, string> = { members: "Members", search: "Search", threads: "Threads", pinned: "Pinned", files: "Files", settings: "Channel settings" };
  const inCh = new Set(ch.members.map((m) => m.user.id));

  return (
    <aside aria-label={titles[panel]} className="flex w-[340px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="flex-1 text-[14px] font-semibold">{titles[panel]}</h2>
        <button type="button" aria-label="Close panel" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {panel === "members" && (
          <>
            {(ch.joined || ch.canManage) && (
              <button type="button" onClick={() => setAdding(!adding)} className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><UserPlus className="h-4 w-4" /> Add people</button>
            )}
            {adding && (
              <ul className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-border p-1">
                {members.filter((m) => !inCh.has(m.id)).map((m) => (
                  <li key={m.id}><button type="button" onClick={() => add.mutate(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Avatar user={m} size={20} /> {userName(m)}</button></li>
                ))}
                {members.every((m) => inCh.has(m.id)) && <li className="px-2 py-2 text-[12px] text-muted-foreground">Everyone is already here.</li>}
              </ul>
            )}
            <ul className="space-y-0.5">
              {ch.members.map((m) => (
                <li key={m.user.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                  <button type="button" onClick={() => openProfile(m.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]"><Avatar user={m.user} size={24} /> <span className="truncate">{userName(m.user)}{m.user.id === user?.id ? " (you)" : ""}</span></button>
                  {m.role === "owner" && <span className="text-[11px] text-muted-foreground">Owner</span>}
                  {ch.canManage && m.user.id !== user?.id && <button type="button" aria-label={`Remove ${userName(m.user)}`} onClick={() => removeM.mutate(m.user.id)} className="hidden text-muted-foreground hover:text-destructive group-hover:block"><X className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
          </>
        )}
        {panel === "search" && (
          <>
            <label className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this conversation" aria-label="Search messages" className="w-full bg-transparent text-[13px] outline-none" /></label>
            <ul className="mt-3 space-y-2">
              {(found?.items ?? []).map((m) => (
                <li key={m.id}><a href={`?message=${m.id}`} className="block rounded-lg border border-border p-2.5 text-[12.5px] hover:bg-accent/40"><span className="font-semibold">{userName(m.user)}</span> <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span><span className="mt-0.5 line-clamp-3 block">{m.content}</span></a></li>
              ))}
              {q.trim().length > 1 && found && !found.items.length && <li className="text-[12.5px] text-muted-foreground">No messages match.</li>}
            </ul>
            <a href={`/work/${ws}/chat/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`} className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"><Search className="h-3.5 w-3.5" /> Search all chats</a>
          </>
        )}
        {panel === "files" && <FilesPanel uid={uid} />}
        {panel === "threads" && (
          <ul className="space-y-2">
            {(threads?.items ?? []).filter((m) => m.replyCount > 0).reverse().map((m) => (
              <li key={m.id}><button type="button" onClick={() => onOpenThread(m.id)} className="block w-full rounded-lg border border-border p-2.5 text-left text-[12.5px] hover:bg-accent/40"><span className="font-semibold">{userName(m.user)}</span><span className="mt-0.5 line-clamp-2 block">{m.content}</span><span className="mt-1 block font-semibold text-primary">{m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}</span></button></li>
            ))}
            {threads && !threads.items.some((m) => m.replyCount > 0) && <li className="text-[12.5px] text-muted-foreground">No threads yet.</li>}
          </ul>
        )}
        {panel === "pinned" && (
          <ul className="space-y-2">
            {ch.pinned.map((m) => (
              <li key={m.id}><a href={`?message=${m.id}`} className="block rounded-lg border border-border p-2.5 text-[12.5px] hover:bg-accent/40"><span className="font-semibold">{userName(m.user)}</span><span className="mt-0.5 line-clamp-3 block">{m.content}</span></a></li>
            ))}
            {!ch.pinned.length && <li className="text-[12.5px] text-muted-foreground">Pin important messages from their ⋯ menu.</li>}
          </ul>
        )}
        {panel === "settings" && (
          <div className="space-y-3 text-[13px]">
            <label className="block"><span className="text-[12px] text-muted-foreground">Name</span><input value={name} onChange={(e) => setName(e.target.value)} disabled={!ch.canManage} aria-label="Channel name" className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 outline-none disabled:opacity-60" /></label>
            <label className="block"><span className="text-[12px] text-muted-foreground">Topic</span><input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!ch.canManage} aria-label="Channel topic" placeholder="What is this channel about?" className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 outline-none disabled:opacity-60" /></label>
            <label className="block"><span className="text-[12px] text-muted-foreground">Description</span><textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!ch.canManage} aria-label="Channel description" rows={3} className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 outline-none disabled:opacity-60" /></label>
            {ch.canManage && <button type="button" onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Save</button>}
            {ch.canManage && (
              <button type="button" onClick={() => window.confirm(`Archive #${ch.name}? Nobody can post in it any more.`) && archive.mutate()} className="flex items-center gap-1.5 pt-3 text-[12.5px] text-destructive hover:underline"><Archive className="h-3.5 w-3.5" /> Archive channel</button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
