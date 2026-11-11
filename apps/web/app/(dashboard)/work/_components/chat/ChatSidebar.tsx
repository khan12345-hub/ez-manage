"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, BellOff, Check, CheckCheck, ChevronDown, ChevronRight, FolderInput, FolderPlus, Hash, LayoutGrid, Link2, ListOrdered, Lock, MailOpen, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, UserRound, Users, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys, type ChatChannelRow, type ChatSection } from "@/services/work.api";
import { Avatar } from "../primitives";
import { OnlineDot, useDirectory, useProfilePanel } from "../people";
import { ShareChannelDialog, useShareChannel } from "./ShareChannel";
import { LocIcon, LocationPicker, type PickedLocation } from "./LocationChannel";
import { chatSidebarKey, useChatSidebar, useWs } from "./useChat";

const ROW = "group flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-[13.5px] transition-colors";
const chatSectionsKey = (ws: string) => ["work", "chat-sections", ws] as const;

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
  const [sectionDlg, setSectionDlg] = useState<{ section?: ChatSection; moveUid?: string } | null>(null);
  const [reordering, setReordering] = useState(false);
  const { data: sections = [] } = useQuery({ queryKey: chatSectionsKey(ws), queryFn: () => workApi.chatSections(ws), enabled: !!ws });
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
  const sectionIds = new Set(sections.map((s) => s.id));
  const inSection = (c: ChatChannelRow) => c.sectionId != null && sectionIds.has(c.sectionId);
  const favorites = data.filter((c) => c.starred);
  const channels = data.filter((c) => c.kind === "channel" && c.joined && !c.starred && !inSection(c));
  const dms = data.filter((c) => c.kind !== "channel" && !c.starred && !inSection(c));
  const sectionRows = (id: number) => data.filter((c) => c.sectionId === id && !c.starred && (c.kind !== "channel" || c.joined));
  const refreshSections = () => { qc.invalidateQueries({ queryKey: chatSectionsKey(ws) }); refresh(); };
  const sectionAct = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refreshSections, onError: err });
  if (!ws) return null;

  const moveMenu = (c: ChatChannelRow) => (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger><FolderInput className="mr-2 h-4 w-4" /> Move to</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <DropdownMenuItem onClick={() => act.mutate(() => workApi.moveChannelToSection(c.uid, null))}>{c.kind === "channel" ? "Channels" : "Direct Messages"}{!inSection(c) && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
        {sections.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => act.mutate(() => workApi.moveChannelToSection(c.uid, s.id))}><span className="truncate">{s.name}</span>{c.sectionId === s.id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setSectionDlg({ moveUid: c.uid })}><FolderPlus className="mr-2 h-4 w-4" /> New section</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );

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
            {moveMenu(c)}
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
            {moveMenu(c)}
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
            c.locationType ? <span className="relative shrink-0" title={`Linked to a ${c.locationType}`}><Hash className="h-4 w-4 text-muted-foreground" /><LocIcon type={c.locationType as "space" | "folder" | "list"} className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-sm bg-background text-primary" /></span> :
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

  const sectionMenu = (k: "ch" | "dm" | ChatSection) => {
    const custom = typeof k === "object" ? k : null;
    const key = custom ? `s${custom.id}` : (k as string);
    const title = custom ? custom.name : k === "ch" ? "Channels" : "Direct Messages";
    const p = pref(key);
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${title} options`} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          {!custom && <DropdownMenuItem onClick={() => (k === "ch" ? router.push(`/work/${ws}/chat/channels`) : router.push(`/work/${ws}/teams`))}><LayoutGrid className="mr-2 h-4 w-4" /> {k === "ch" ? "Browse Channels" : "Browse people"}</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => act.mutate(() => workApi.chatReadAll(ws, custom ? custom.id : k === "ch" ? "channels" : "dms"))}><CheckCheck className="mr-2 h-4 w-4" /> Mark all as read</DropdownMenuItem>
          <DropdownMenuSeparator />
          {custom && <DropdownMenuItem onClick={() => setSectionDlg({ section: custom })}><Pencil className="mr-2 h-4 w-4" /> Rename section</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => setSectionDlg({})}><FolderPlus className="mr-2 h-4 w-4" /> Create section</DropdownMenuItem>
          {sections.length > 1 && <DropdownMenuItem onClick={() => setReordering(true)}><ListOrdered className="mr-2 h-4 w-4" /> Reorder sections</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><ArrowUpDown className="mr-2 h-4 w-4" /> Show and sort</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Show in section</p>
              {([["all", "All"], ["unread", "Unread"], ["mentions", "Mentions Only"]] as const).map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => setPref(key, { show: v })}>{l}{p.show === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Sort section</p>
              {([["recent", "Recents"], ["alpha", "Alphabetically"]] as const).map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => setPref(key, { sort: v })}>{l}{p.sort === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Hash className="mr-2 h-4 w-4" /> Limit <span className="ml-auto font-mono text-[11px] text-muted-foreground">{p.limit >= 999 ? "All" : p.limit}</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              {[10, 20, 40, 999].map((n) => <DropdownMenuItem key={n} onClick={() => setPref(key, { limit: n })}>{n >= 999 ? "Show all" : n}{p.limit === n && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {custom && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.confirm(`Delete the section "${custom.name}"? Its channels and messages move back to Channels and Direct Messages.`) && sectionAct.mutate(() => workApi.deleteChatSection(custom.id))} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete section</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const head = (k: string, title: string, extra: React.ReactNode) => (
    <div className="flex items-center gap-0.5 px-2 pb-1">
      <button type="button" onClick={() => setOpen({ ...open, [k]: !(open[k] ?? true) })} aria-expanded={open[k] ?? true} className="flex flex-1 items-center gap-1 text-left text-[12px] font-semibold text-muted-foreground hover:text-foreground">
        <span className="truncate">{title}</span> {(open[k] ?? true) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
      {sections.map((s) => {
        const r = arrange(sectionRows(s.id), `s${s.id}`);
        const k = `s${s.id}`;
        return (
          <section key={s.id} aria-label={s.name}>
            {head(k, s.name, sectionMenu(s))}
            {(open[k] ?? true) && (
              <div className="space-y-px">
                {r.rows.map(rowFor)}
                {r.more > 0 && <button type="button" onClick={() => setPref(k, { limit: 999 })} className={cn(ROW, "text-muted-foreground hover:bg-accent/60")}>Show {r.more} more</button>}
                {!r.rows.length && !r.more && <p className="px-2 py-1 text-[12px] text-muted-foreground">Use “Move to” on a channel or direct message to add it here.</p>}
              </div>
            )}
          </section>
        );
      })}
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
      {sectionDlg && <SectionNameDialog section={sectionDlg.section} moveUid={sectionDlg.moveUid} onClose={() => setSectionDlg(null)} />}
      {reordering && <ReorderSectionsDialog sections={sections} onClose={() => setReordering(false)} />}
      <ShareChannelDialog />
    </div>
  );
}

/** "Create section" / "Rename section"; a new section can take a conversation straight away ("Move to → New section") */
function SectionNameDialog({ section, moveUid, onClose }: { section?: ChatSection; moveUid?: string; onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const [v, setV] = useState(section?.name ?? "");
  const save = useMutation({
    mutationFn: async () => {
      if (section) return workApi.renameChatSection(section.id, v.trim());
      const s = await workApi.createChatSection(ws, v.trim());
      if (moveUid) await workApi.moveChannelToSection(moveUid, s.id);
      return s;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatSectionsKey(ws) });
      qc.invalidateQueries({ queryKey: chatSidebarKey(ws) });
      toast.success(section ? "Section renamed" : "Section created");
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't save the section."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle>{section ? "Rename section" : "Create section"}</DialogTitle>
        <DialogDescription>{section ? "Only you see your sections." : "Group channels and direct messages your way. Only you see your sections."}</DialogDescription>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && save.mutate()} placeholder="e.g. Clients, Launch, Leadership" aria-label="Section name" maxLength={60} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!v.trim() || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{section ? "Save" : "Create"}</button></div>
      </DialogContent>
    </Dialog>
  );
}

/** "Reorder sections": move your sections up and down */
function ReorderSectionsDialog({ sections, onClose }: { sections: ChatSection[]; onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const [order, setOrder] = useState(sections);
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    setOrder(next);
  };
  const save = useMutation({
    mutationFn: () => workApi.reorderChatSections(ws, order.map((s) => s.id)),
    onSuccess: (rows) => { qc.setQueryData(chatSectionsKey(ws), rows); toast.success("Sections reordered"); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't reorder."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle>Reorder sections</DialogTitle>
        <DialogDescription>Your sections appear in this order, above Channels and Direct Messages.</DialogDescription>
        <ol aria-label="Section order" className="space-y-1">
          {order.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13.5px]">
              <span className="w-5 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{s.name}</span>
              <button type="button" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={`Move ${s.name} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ol>
        <div className="flex justify-end"><button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Save order</button></div>
      </DialogContent>
    </Dialog>
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
export function CreateChannelDialog({ onClose, initialLocation = null, suggestedName = "" }: { onClose: () => void; initialLocation?: PickedLocation | null; suggestedName?: string }) {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { data: dir } = useDirectory();
  const [name, setName] = useState(suggestedName);
  const [isPrivate, setPrivate] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const [withList, setWithList] = useState(!!initialLocation);
  const [loc, setLoc] = useState<PickedLocation | null>(initialLocation);
  const people = (dir?.people ?? []).filter((p) => p.user.id !== user?.id);
  const create = useMutation({
    mutationFn: () => workApi.createChannel(ws, { name, isPrivate, ...(isPrivate && ids.length ? { memberIds: ids } : {}), ...(withList && loc ? { locationType: loc.type, locationId: loc.id } : {}) }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); qc.invalidateQueries({ queryKey: ["work", "loc-channels"] }); toast.success(`#${c.name} created`); onClose(); router.push(`/work/${ws}/chat/${c.uid}`); },
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
          {withList && <LocationPicker value={loc} onChange={setLoc} />}
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-6 py-3">
          <button type="button" disabled={!name.trim() || (withList && !loc) || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Create</button>
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
