"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown, Bell, BellOff, Check, CheckCheck, ChevronDown, ChevronRight, Hash, LayoutGrid, Link2, Lock, MailOpen, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, UserRound, Users, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys, type ChatChannelRow } from "@/services/work.api";
import { Avatar } from "../primitives";
import { OnlineDot, useDirectory, useProfilePanel } from "../people";
import { ShareChannelDialog, useShareChannel } from "./ShareChannel";
import { chatSidebarKey, useChatSidebar, useWs } from "./useChat";

const ROW = "group flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-[13.5px] transition-colors";

type Show = "all" | "unread" | "mentions";
type Sort = "recent" | "alpha";
type SectionPrefs = { show: Show; sort: Sort; limit: number };
const PREFS_KEY = "ez:work:chatSections";
const DEFAULT_PREFS: SectionPrefs = { show: "all", sort: "recent", limit: 20 };
function loadPrefs(): Record<string, SectionPrefs> {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); } catch { return {}; }
}

/** "Channels", "Direct Messages" (and "Favorites") sections of the Work sidebar, with ClickUp's ⋯ menus. */
export function ChatSidebarSections({ onNavigate }: { onNavigate?: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { data = [] } = useChatSidebar();
  const { data: dir } = useDirectory();
  const openShare = useShareChannel((s) => s.open);
  const openProfile = useProfilePanel((s) => s.open);
  const [open, setOpen] = useState<Record<string, boolean>>({ fav: true, ch: true, dm: true });
  const [prefs, setPrefs] = useState<Record<string, SectionPrefs>>({});
  const [creating, setCreating] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [renaming, setRenaming] = useState<{ uid: string; name: string } | null>(null);
  useEffect(() => setPrefs(loadPrefs()), []);
  const pref = (k: string) => ({ ...DEFAULT_PREFS, ...(prefs[k] ?? {}) });
  const setPref = (k: string, p: Partial<SectionPrefs>) => {
    const next = { ...prefs, [k]: { ...pref(k), ...p } };
    setPrefs(next);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
  };
  const refresh = () => qc.invalidateQueries({ queryKey: chatSidebarKey(ws) });
  const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh, onError: err });
  const online = (id: number) => dir?.people.find((p) => p.user.id === id)?.online;
  const href = (uid: string) => `/work/${ws}/chat/${uid}`;
  const active = (uid: string) => pathname === href(uid);

  const arrange = (rows: ChatChannelRow[], k: string) => {
    const p = pref(k);
    const shown = rows.filter((c) => (p.show === "unread" ? c.unread > 0 || active(c.uid) : p.show === "mentions" ? c.mentions > 0 || active(c.uid) : true));
    const sorted = [...shown].sort((a, b) => (p.sort === "alpha" ? label(a).localeCompare(label(b)) : (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")));
    return { rows: sorted.slice(0, p.limit), more: Math.max(0, sorted.length - p.limit) };
  };
  const label = (c: ChatChannelRow) => (c.kind === "channel" ? c.name ?? "" : c.people.length ? c.people.map((p) => (c.people.length > 1 ? p.firstName : userName(p))).join(", ") : `${user?.firstName ?? "You"} — You`);
  const favorites = data.filter((c) => c.starred);
  const channels = data.filter((c) => c.kind === "channel" && c.joined && !c.starred);
  const dms = data.filter((c) => c.kind !== "channel" && !c.starred);
  if (!ws) return null;

  const badge = (c: ChatChannelRow) =>
    c.mentions > 0 ? <span className="rounded-full bg-destructive px-1.5 font-mono text-[10.5px] text-white">{c.mentions}</span>
    : c.unread > 0 && !c.muted ? <span className="rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{c.unread}</span>
    : null;

  const rowMenu = (c: ChatChannelRow) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`${label(c)} options`} onClick={(e) => e.preventDefault()} className="invisible rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground group-hover:visible data-[state=open]:visible"><MoreHorizontal className="h-3.5 w-3.5" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-60">
        <DropdownMenuItem onClick={() => act.mutate(() => workApi.unreadChannel(c.uid))}><MailOpen className="mr-2 h-4 w-4" /> Mark as unread</DropdownMenuItem>
        {c.kind === "channel" ? (
          <>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}${href(c.uid)}`).then(() => toast.success("Link copied"))}><Link2 className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
            <DropdownMenuItem onClick={() => act.mutate(() => workApi.channelPrefs(c.uid, { starred: !c.starred }))}><Star className="mr-2 h-4 w-4" /> {c.starred ? "Remove from Favorites" : "Favorite"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setRenaming({ uid: c.uid, name: c.name ?? "" })}><Pencil className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.confirm(`Delete #${c.name}? Nobody can post in it any more.`) && act.mutate(() => workApi.archiveChannel(c.uid))} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Bell className="mr-2 h-4 w-4" /> Notification settings</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {([["all", "All new messages"], ["mentions", "Mentions only"], ["none", "Nothing"]] as const).map(([v, l]) => (
                  <DropdownMenuItem key={v} onClick={() => act.mutate(() => workApi.channelPrefs(c.uid, { notify: v }))}>{l}{c.notify === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => act.mutate(() => workApi.leaveChannel(c.uid))}>
              <BellOff className="mr-2 h-4 w-4" />
              <span><span className="block">Unfollow</span><span className="block text-[11px] text-muted-foreground">Follow it again from All Channels</span></span>
            </DropdownMenuItem>
            <div className="p-1">
              <button type="button" onClick={() => openShare(c.uid)} className="h-8 w-full rounded-md bg-forest text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">Sharing &amp; Permissions</button>
            </div>
          </>
        ) : (
          <>
            {c.people.length === 1 && <DropdownMenuItem onClick={() => openProfile(c.people[0]!.id)}><UserRound className="mr-2 h-4 w-4" /> View Profile</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => act.mutate(() => workApi.channelPrefs(c.uid, { starred: !c.starred }))}><Star className="mr-2 h-4 w-4" /> {c.starred ? "Remove from Favorites" : "Favorite"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { act.mutate(() => workApi.closeDm(c.uid)); if (active(c.uid)) router.push(`/work/${ws}`); }}>
              <XCircle className="mr-2 h-4 w-4" />
              <span><span className="block">Close DM</span><span className="block text-[11px] text-muted-foreground">Will reappear with new messages</span></span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const rowFor = (c: ChatChannelRow) => {
    const one = c.kind !== "channel" && c.people.length === 1 ? c.people[0]! : null;
    return (
      <div key={c.uid} className={cn(ROW, "pr-1", active(c.uid) ? "bg-accent font-semibold text-accent-foreground" : c.unread && !c.muted ? "font-semibold text-foreground hover:bg-accent/60" : "text-foreground/80 hover:bg-accent/60")}>
        <Link href={href(c.uid)} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2">
          {c.kind === "channel" ? (
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : one ? (
            <span className="relative shrink-0"><Avatar user={one} size={18} /><OnlineDot online={online(one.id)} className="absolute -bottom-0.5 -right-0.5 h-2 w-2" /></span>
          ) : (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted"><Users className="h-3 w-3" /></span>
          )}
          <span className="min-w-0 flex-1 truncate">{label(c)}</span>
          {c.isPrivate && c.kind === "channel" && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {c.muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </Link>
        {badge(c)}
        {rowMenu(c)}
      </div>
    );
  };

  const sectionMenu = (k: "ch" | "dm") => {
    const p = pref(k);
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${k === "ch" ? "Channels" : "Direct Messages"} options`} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          <DropdownMenuItem onClick={() => (k === "ch" ? router.push(`/work/${ws}/chat/channels`) : router.push(`/work/${ws}/teams`))}><LayoutGrid className="mr-2 h-4 w-4" /> {k === "ch" ? "Browse Channels" : "Browse people"}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => act.mutate(() => workApi.chatReadAll(ws, k === "ch" ? "channels" : "dms"))}><CheckCheck className="mr-2 h-4 w-4" /> Mark all as read</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><ArrowUpDown className="mr-2 h-4 w-4" /> Show and sort</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Show in section</p>
              {([["all", "All"], ["unread", "Unread"], ["mentions", "Mentions Only"]] as const).map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => setPref(k, { show: v })}>{l}{p.show === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Sort section</p>
              {([["recent", "Recents"], ["alpha", "Alphabetically"]] as const).map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => setPref(k, { sort: v })}>{l}{p.sort === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Hash className="mr-2 h-4 w-4" /> Limit <span className="ml-auto font-mono text-[11px] text-muted-foreground">{p.limit >= 999 ? "All" : p.limit}</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              {[10, 20, 40, 999].map((n) => <DropdownMenuItem key={n} onClick={() => setPref(k, { limit: n })}>{n >= 999 ? "Show all" : n}{p.limit === n && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const head = (k: string, title: string, extra: React.ReactNode) => (
    <div className="flex items-center gap-0.5 px-2 pb-1">
      <button type="button" onClick={() => setOpen({ ...open, [k]: !open[k] })} className="flex flex-1 items-center gap-1 text-left text-[12px] font-semibold text-muted-foreground hover:text-foreground">
        {title} {open[k] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {extra}
    </div>
  );
  const ch = arrange(channels, "ch");
  const dm = arrange(dms, "dm");

  return (
    <div className="mt-3 space-y-3">
      {favorites.length > 0 && (
        <section aria-label="Favorites">
          {head("fav", "Favorites", null)}
          {open.fav && <div className="space-y-px">{favorites.map(rowFor)}</div>}
        </section>
      )}
      <section aria-label="Channels">
        {head("ch", "Channels", <>{sectionMenu("ch")}<button type="button" aria-label="Add Channel" title="Add Channel" onClick={() => setCreating(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></>)}
        {open.ch && (
          <div className="space-y-px">
            {ch.rows.map(rowFor)}
            {ch.more > 0 && <button type="button" onClick={() => setPref("ch", { limit: 999 })} className={cn(ROW, "text-muted-foreground hover:bg-accent/60")}>Show {ch.more} more</button>}
            <Link href={`/work/${ws}/chat/channels`} onClick={onNavigate} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Search className="h-3.5 w-3.5 shrink-0" /> Browse channels</Link>
            <button type="button" onClick={() => setCreating(true)} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Plus className="h-3.5 w-3.5 shrink-0" /> Add Channel</button>
          </div>
        )}
      </section>
      <section aria-label="Direct Messages">
        {head("dm", "Direct Messages", <>{sectionMenu("dm")}<button type="button" aria-label="New message" title="New message" onClick={() => setMessaging(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></>)}
        {open.dm && (
          <div className="space-y-px">
            {dm.rows.map(rowFor)}
            {dm.more > 0 && <button type="button" onClick={() => setPref("dm", { limit: 999 })} className={cn(ROW, "text-muted-foreground hover:bg-accent/60")}>Show {dm.more} more</button>}
            <button type="button" onClick={() => setMessaging(true)} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Plus className="h-3.5 w-3.5 shrink-0" /> New message</button>
          </div>
        )}
      </section>

      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
      {messaging && <NewMessageDialog onClose={() => setMessaging(false)} />}
      {renaming && <RenameChannelDialog uid={renaming.uid} name={renaming.name} onClose={() => setRenaming(null)} />}
      <ShareChannelDialog />
    </div>
  );
}

function RenameChannelDialog({ uid, name, onClose }: { uid: string; name: string; onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const [v, setV] = useState(name);
  const save = useMutation({
    mutationFn: () => workApi.updateChannel(uid, { name: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); qc.invalidateQueries({ queryKey: ["work", "chat-channel", uid] }); toast.success("Channel renamed"); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't rename."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle>Rename channel</DialogTitle>
        <DialogDescription className="sr-only">New channel name</DialogDescription>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && save.mutate()} aria-label="New channel name" maxLength={80} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!v.trim() || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Save</button></div>
      </DialogContent>
    </Dialog>
  );
}

/** ClickUp "Create Channel": name, make private (+ who), add a list */
export function CreateChannelDialog({ onClose }: { onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { data: dir } = useDirectory();
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws) });
  const [name, setName] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const [withList, setWithList] = useState(false);
  const [listId, setListId] = useState<number | null>(null);
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, name: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, name: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  const people = (dir?.people ?? []).filter((p) => p.user.id !== user?.id);
  const create = useMutation({
    mutationFn: () => workApi.createChannel(ws, { name, isPrivate, ...(isPrivate && ids.length ? { memberIds: ids } : {}), ...(withList && listId ? { locationType: "list", locationId: listId } : {}) }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); toast.success(`#${c.name} created`); onClose(); router.push(`/work/${ws}/chat/${c.uid}`); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't create the channel."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <div className="px-6 pb-4 pt-6">
          <DialogTitle className="text-[17px]">Create Channel</DialogTitle>
          <DialogDescription className="mt-1 text-[13px]">Chat Channels are where conversations happen. Use a name that is easy to find and understand.</DialogDescription>
          <label className="mt-5 block text-[13px] font-medium">Name<span className="text-destructive">*</span></label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()} placeholder="e.g. Ideas" aria-label="Channel name" maxLength={80} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
          <div className="mt-5 flex items-center gap-3">
            <span className="flex-1"><span className="block text-[13.5px] font-medium">Make Private</span><span className="block text-[12.5px] text-muted-foreground">Only you and invited members have access</span></span>
            <Switch checked={isPrivate} onCheckedChange={setPrivate} aria-label="Make Private" />
          </div>
          {isPrivate && (
            <ul aria-label="Invite people" className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-1">
              {people.map((p) => {
                const on = ids.includes(p.user.id);
                return (
                  <li key={p.user.id}>
                    <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setIds(on ? ids.filter((x) => x !== p.user.id) : [...ids, p.user.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                      <Avatar user={p.user} size={20} /> <span className="flex-1 truncate">{userName(p.user)}</span>{on && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-3">
            <span className="flex-1"><span className="block text-[13.5px] font-medium">Add a List</span><span className="block text-[12.5px] text-muted-foreground">Attach a List to manage tasks and work</span></span>
            <Switch checked={withList} onCheckedChange={setWithList} aria-label="Add a List" />
          </div>
          {withList && (
            <select aria-label="List" value={listId ?? ""} onChange={(e) => setListId(Number(e.target.value) || null)} className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px]">
              <option value="">Choose a list…</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-6 py-3">
          <button type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Create</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** start a DM (one person) or a group message (several) */
export function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { data: dir } = useDirectory();
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  const people = (dir?.people ?? []).filter((p) => p.user.id !== user?.id && userName(p.user).toLowerCase().includes(q.toLowerCase()));
  const open = useMutation({
    mutationFn: () => workApi.openDm(ws, ids),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); onClose(); router.push(`/work/${ws}/chat/${r.uid}`); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't start the conversation."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle>New message</DialogTitle>
        <DialogDescription>Pick one person for a direct message, or several for a group.</DialogDescription>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <ul className="max-h-64 overflow-y-auto">
          {people.map((p) => {
            const on = ids.includes(p.user.id);
            return (
              <li key={p.user.id}>
                <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setIds(on ? ids.filter((x) => x !== p.user.id) : [...ids, p.user.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                  <span className="relative"><Avatar user={p.user} size={24} /><OnlineDot online={p.online} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate">{userName(p.user)}</span>{p.title && <span className="block truncate text-[11px] text-muted-foreground">{p.title}</span>}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <button type="button" disabled={!ids.length || open.isPending} onClick={() => open.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
            {ids.length > 1 ? "Start group message" : "Message"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
