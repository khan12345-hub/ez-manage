"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Hash, Lock, Plus, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys } from "@/services/work.api";
import { Avatar } from "../primitives";
import { OnlineDot, useDirectory } from "../people";
import { chatSidebarKey, useChatSidebar, useWs } from "./useChat";

const ROW = "group flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-[13.5px] transition-colors";

/** "Channels" and "Direct Messages" sections of the Work sidebar (ClickUp). */
export function ChatSidebarSections({ onNavigate }: { onNavigate?: () => void }) {
  const ws = useWs();
  const pathname = usePathname();
  const { user } = useAuth();
  const { data = [] } = useChatSidebar();
  const { data: dir } = useDirectory();
  const [openCh, setOpenCh] = useState(true);
  const [openDm, setOpenDm] = useState(true);
  const [creating, setCreating] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const channels = data.filter((c) => c.kind === "channel" && (c.joined || c.starred)).sort((a, b) => Number(b.starred) - Number(a.starred) || (a.name ?? "").localeCompare(b.name ?? ""));
  const dms = data.filter((c) => c.kind !== "channel");
  const online = (id: number) => dir?.people.find((p) => p.user.id === id)?.online;
  const href = (uid: string) => `/work/${ws}/chat/${uid}`;
  const active = (uid: string) => pathname === href(uid);
  if (!ws) return null;

  return (
    <div className="mt-3 space-y-3">
      <section aria-label="Channels">
        <div className="flex items-center px-2 pb-1">
          <button type="button" onClick={() => setOpenCh(!openCh)} className="flex flex-1 items-center gap-1 text-left text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            Channels {openCh ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <button type="button" aria-label="Add Channel" title="Add Channel" onClick={() => setCreating(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        {openCh && (
          <div className="space-y-px">
            {channels.map((c) => (
              <Link key={c.uid} href={href(c.uid)} onClick={onNavigate} className={cn(ROW, active(c.uid) ? "bg-accent font-semibold text-accent-foreground" : c.unread ? "font-semibold text-foreground hover:bg-accent/60" : "text-foreground/80 hover:bg-accent/60")}>
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                {c.mentions > 0 ? <span className="rounded-full bg-destructive px-1.5 font-mono text-[10.5px] text-white">{c.mentions}</span> : c.unread > 0 && !c.muted ? <span className="rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{c.unread}</span> : null}
              </Link>
            ))}
            <Link href={`/work/${ws}/chat/channels`} onClick={onNavigate} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
              <Search className="h-3.5 w-3.5 shrink-0" /> Browse channels
            </Link>
            <button type="button" onClick={() => setCreating(true)} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
              <Plus className="h-3.5 w-3.5 shrink-0" /> Add Channel
            </button>
          </div>
        )}
      </section>

      <section aria-label="Direct Messages">
        <div className="flex items-center px-2 pb-1">
          <button type="button" onClick={() => setOpenDm(!openDm)} className="flex flex-1 items-center gap-1 text-left text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            Direct Messages {openDm ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <button type="button" aria-label="New message" title="New message" onClick={() => setMessaging(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        {openDm && (
          <div className="space-y-px">
            {dms.map((c) => {
              const one = c.people.length === 1 ? c.people[0]! : null;
              const label = c.people.length ? c.people.map((p) => (c.people.length > 1 ? p.firstName : userName(p))).join(", ") : `${user?.firstName ?? "You"} — You`;
              return (
                <Link key={c.uid} href={href(c.uid)} onClick={onNavigate} className={cn(ROW, active(c.uid) ? "bg-accent font-semibold text-accent-foreground" : c.unread ? "font-semibold text-foreground hover:bg-accent/60" : "text-foreground/80 hover:bg-accent/60")}>
                  {one ? (
                    <span className="relative shrink-0"><Avatar user={one} size={18} /><OnlineDot online={online(one.id)} className="absolute -bottom-0.5 -right-0.5 h-2 w-2" /></span>
                  ) : (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted"><Users className="h-3 w-3" /></span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {c.unread > 0 && !c.muted && <span className="rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{c.unread}</span>}
                </Link>
              );
            })}
            <button type="button" onClick={() => setMessaging(true)} className={cn(ROW, "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
              <Plus className="h-3.5 w-3.5 shrink-0" /> New message
            </button>
          </div>
        )}
      </section>

      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
      {messaging && <NewMessageDialog onClose={() => setMessaging(false)} />}
    </div>
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
