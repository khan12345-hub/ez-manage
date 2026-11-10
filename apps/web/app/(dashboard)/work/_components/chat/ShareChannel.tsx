"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Hash, Link2, Lock, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, type ChatPermission } from "@/services/work.api";
import { Avatar, AvatarStack } from "../primitives";
import { useDirectory } from "../people";
import { channelKey, chatSidebarKey, useWs } from "./useChat";

export const PERMISSIONS: { id: ChatPermission; label: string; hint: string }[] = [
  { id: "full", label: "Full edit", hint: "Can post, pin, manage people and channel settings." },
  { id: "edit", label: "Edit", hint: "Can post messages and posts, and pin. Can't manage the channel." },
  { id: "comment", label: "Comment", hint: "Can send messages and reply. Can't write posts or pin." },
  { id: "view", label: "View only", hint: "Read-only. Can't send messages in this channel." },
];

/** which channel's Sharing & Permissions dialog is open */
export const useShareChannel = create<{ uid: string | null; open: (uid: string) => void; close: () => void }>((set) => ({
  uid: null,
  open: (uid) => set({ uid }),
  close: () => set({ uid: null }),
}));

function PermissionPick({ value, disabled, onChange, small }: { value: ChatPermission; disabled?: boolean; onChange: (p: ChatPermission) => void; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = PERMISSIONS.find((p) => p.id === value)?.label ?? value;
  if (disabled) return <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-[12px] italic text-muted-foreground">{label}</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-accent", small ? "text-[11.5px]" : "text-[12px]")}>{label} <ChevronDown className="h-3 w-3" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        {PERMISSIONS.map((p) => (
          <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); }} className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent">
            <span className="flex-1"><span className="block text-[13px] font-medium">{p.label}</span><span className="block text-[11.5px] leading-snug text-muted-foreground">{p.hint}</span></span>
            {value === p.id && <Check className="mt-0.5 h-4 w-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** "Share this Channel" (ClickUp Sharing & Permissions). Mounted once in the sidebar. */
export function ShareChannelDialog() {
  const { uid, close } = useShareChannel();
  const ws = useWs();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: dir } = useDirectory(!!uid);
  const { data: ch } = useQuery({ queryKey: channelKey(uid ?? ""), queryFn: () => workApi.channel(uid!), enabled: !!uid });
  const [expanded, setExpanded] = useState(true);
  const [q, setQ] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: channelKey(uid!) }); qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); };
  const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't change sharing.");
  const setPerm = useMutation({ mutationFn: ({ id, p }: { id: number; p: ChatPermission }) => workApi.setChannelPermission(uid!, id, p), onSuccess: refresh, onError: err });
  const setAll = useMutation({ mutationFn: (p: ChatPermission) => workApi.setAllChannelPermissions(uid!, p), onSuccess: () => { refresh(); toast.success("Updated everyone's access"); }, onError: err });
  const privacy = useMutation({ mutationFn: (isPrivate: boolean) => workApi.updateChannel(uid!, { isPrivate }), onSuccess: refresh, onError: err });
  const invite = useMutation({ mutationFn: (id: number) => workApi.addChannelMembers(uid!, [id]), onSuccess: () => { setQ(""); refresh(); toast.success("Added to the channel"); }, onError: err });
  const remove = useMutation({ mutationFn: (id: number) => workApi.removeChannelMember(uid!, id), onSuccess: refresh, onError: err });
  if (!uid) return null;
  const inCh = new Set(ch?.members.map((m) => m.user.id) ?? []);
  const matches = q.trim() ? (dir?.people ?? []).filter((p) => !inCh.has(p.user.id) && `${userName(p.user)} ${p.user.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const roleTag = (r: string | null) => (r === "OWNER" ? "Workspace Owner" : r === "ADMIN" ? "Admin" : null);

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <div className="px-6 pb-3 pt-5">
          <DialogTitle className="text-[16px]">Share this Channel</DialogTitle>
          <DialogDescription className="mt-1 flex items-center gap-1 text-[13px]">Sharing <Hash className="h-3.5 w-3.5" /> <strong className="font-semibold text-foreground">{ch?.name}</strong></DialogDescription>
          {ch?.canManage && (
            <div className="relative mt-4">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invite by name or email" aria-label="Invite by name or email" className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-20 text-[13.5px] outline-none focus:border-primary/50" />
              <span className="absolute right-1.5 top-1.5 rounded-md bg-forest px-2.5 py-1 text-[12px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Invite</span>
              {matches.length > 0 && (
                <ul className="absolute inset-x-0 top-11 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {matches.map((p) => (
                    <li key={p.user.id}><button type="button" onClick={() => invite.mutate(p.user.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Avatar user={p.user} size={20} /> {userName(p.user)} <span className="ml-auto text-[11.5px] text-muted-foreground">{p.user.email}</span></button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 text-[13px]">
            <Link2 className="h-4 w-4" /> <span className="font-medium">Private link</span>
            <span className="flex-1" />
            <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/work/${ws}/chat/${uid}`).then(() => toast.success("Link copied"))} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-accent">Copy link</button>
          </div>
        </div>
        <div className="border-t border-border px-6 py-3">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Share with</p>
          <div className="flex items-center gap-2">
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex flex-1 items-center gap-1.5 text-left text-[13.5px] font-medium">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {ch?.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />} {ch?.name}
            </button>
            {ch && <AvatarStack users={ch.members.map((m) => m.user)} size={22} max={4} />}
            <span title={ch?.isPrivate ? "Private: only the people below" : "Everyone in the workspace can find and join"}>
              <Switch checked={!ch?.isPrivate} disabled={!ch?.canManage} onCheckedChange={(v) => privacy.mutate(!v)} aria-label="Everyone in the workspace can join" />
            </span>
          </div>
          <p className="mt-1 pl-5 text-[11.5px] text-muted-foreground">{ch?.isPrivate ? "Private — only the people below can see it." : "Public — everyone in the workspace can find and join it."}</p>
        </div>
        {expanded && ch && (
          <div className="max-h-[360px] overflow-y-auto border-t border-border bg-muted/30 px-6 py-3">
            <div className="mb-2 flex items-center">
              <span className="flex-1 text-[12px] text-muted-foreground">{ch.members.length} {ch.members.length === 1 ? "Person" : "People"}</span>
              {ch.canManage && <EditAll onPick={(p) => setAll.mutate(p)} />}
            </div>
            <ul aria-label="People with access" className="space-y-1">
              {ch.members.map((m) => {
                const tag = roleTag(m.workRole);
                const locked = !ch.canManage || !!tag || m.user.id === user?.id;
                return (
                  <li key={m.user.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1">
                    <Avatar user={m.user} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{userName(m.user)}{m.user.id === user?.id ? " (you)" : ""}</span>
                    {tag && <span className="rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{tag}</span>}
                    {m.role === "owner" && !tag && <span className="rounded bg-[#b08d57]/15 px-1.5 text-[11px] font-medium text-[#8a6a3a]">Channel Creator</span>}
                    <PermissionPick value={m.permission} disabled={locked} onChange={(p) => setPerm.mutate({ id: m.user.id, p })} />
                    {ch.canManage && !tag && m.user.id !== user?.id && (
                      <button type="button" aria-label={`Remove ${userName(m.user)}`} onClick={() => remove.mutate(m.user.id)} className="invisible rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:visible"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditAll({ onPick }: { onPick: (p: ChatPermission) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[12px] hover:bg-accent">Edit all <ChevronDown className="h-3 w-3" /></button></PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        {PERMISSIONS.map((p) => <button key={p.id} type="button" onClick={() => { onPick(p.id); setOpen(false); }} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-accent">{p.label}</button>)}
      </PopoverContent>
    </Popover>
  );
}
