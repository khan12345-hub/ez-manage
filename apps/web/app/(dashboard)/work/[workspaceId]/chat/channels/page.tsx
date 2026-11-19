"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Hash, Lock, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { userName, workApi, type ManagedChannel } from "@/services/work.api";
import { Avatar } from "../../../_components/primitives";
import { useDirectory } from "../../../_components/people";
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
const err = (e: any, fb: string) => toast.error(e?.response?.data?.message?.toString?.() ?? fb);

/** Channels: the ones you are in (conversations are only for the people in them); owners / admins also manage every channel */
export default function AllChannelsPage() {
  const ws = useWs();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { data = [] } = useChatSidebar();
  const { data: dir } = useDirectory();
  const isAdmin = ["OWNER", "ADMIN"].includes((dir?.people ?? []).find((p) => p.user.id === user?.id)?.role ?? "");
  const { data: all = [] } = useQuery({ queryKey: ["work", "manage-channels", ws], queryFn: () => workApi.manageChannels(ws), enabled: isAdmin });
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<ManagedChannel | null>(null);
  const [adding, setAdding] = useState<ManagedChannel | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: chatSidebarKey(ws) }); qc.invalidateQueries({ queryKey: ["work", "manage-channels", ws] }); };
  const join = useMutation({ mutationFn: (uid: string) => workApi.joinChannel(uid), onSuccess: (_r, uid) => { refresh(); setJoining(null); router.push(`/work/${ws}/chat/${uid}`); }, onError: (e) => err(e, "Couldn't join.") });
  const leave = useMutation({ mutationFn: (uid: string) => workApi.leaveChannel(uid), onSuccess: refresh, onError: (e) => err(e, "Couldn't leave.") });
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const rows = data.filter((c) => c.kind === "channel" && match(`${c.name} ${c.topic ?? ""}`));
  const others = all.filter((c) => !c.joined && match(c.name ?? ""));

  return (
    <div className="w-full">
      <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <h1 className="text-[15px] font-semibold">Channels</h1>
        <span className="flex-1" />
        <button type="button" onClick={() => setCreating(true)} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Create Channel</button>
      </header>
      <div className="px-4 py-4 sm:px-6">
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-primary/[0.06] px-3 py-2 text-[12.5px] text-foreground/80"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> A channel is only for the people in it. You see the channels you were added to; ask someone in a channel to add you.</p>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels" aria-label="Search channels" className="w-full bg-transparent text-[13.5px] outline-none" /></label>

        <h2 className="mb-1 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Your channels</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                <th className="py-2 pl-2 font-medium">Channel</th><th className="hidden py-2 font-medium sm:table-cell">Topic</th><th className="w-16 py-2 font-medium">People</th><th className="hidden w-32 py-2 font-medium sm:table-cell">Last updated</th><th className="w-28 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.uid} className="border-b border-border/60 hover:bg-accent/30">
                  <td className="py-2.5 pl-2">
                    <Link href={`/work/${ws}/chat/${c.uid}`} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card">{c.isDefault ? <Users className="h-4 w-4 text-primary" /> : <Hash className="h-4 w-4 text-muted-foreground" />}</span>
                      <span><span className="flex items-center gap-1.5 font-semibold">{c.name}{c.isDefault && <span className="rounded-full bg-primary/10 px-1.5 text-[10.5px] font-medium text-primary">Everyone</span>}</span><span className="block text-[11.5px] text-muted-foreground">{c.description || (c.locationType ? `in a ${c.locationType}` : "in Workspace")}</span></span>
                    </Link>
                  </td>
                  <td className="hidden text-muted-foreground sm:table-cell">{c.topic ?? ""}</td>
                  <td>{c.memberCount}</td>
                  <td className="hidden text-muted-foreground sm:table-cell">{ago(c.lastMessageAt)}</td>
                  <td className="pr-2 text-right">
                    {c.joined ? (
                      <button type="button" onClick={() => leave.mutate(c.uid)} className="group/f h-7 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-accent"><span className="group-hover/f:hidden">Member</span><span className="hidden group-hover/f:inline">Leave</span></button>
                    ) : (
                      <button type="button" onClick={() => join.mutate(c.uid)} className="h-7 rounded-md border border-border px-2.5 text-[12px] font-medium hover:bg-accent">Join</button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">{q ? "No channels match." : "You're not in any channel yet — create one, or ask to be added."}</td></tr>}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <section aria-label="Manage channels" className="mt-8">
            <h2 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Manage channels · owners &amp; admins</h2>
            <p className="mb-2 text-[12px] text-muted-foreground">Other channels in this workspace. You see their names and how many people are in them — not their messages. Joining shows everyone that you joined.</p>
            <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
              {others.map((c) => (
                <li key={c.uid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border"><Lock className="h-4 w-4 text-muted-foreground" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{c.name}</span><span className="block text-[11.5px] text-muted-foreground">{c.memberCount} {c.memberCount === 1 ? "person" : "people"} · updated {ago(c.lastMessageAt ?? c.createdAt)}</span></span>
                  <button type="button" onClick={() => setAdding(c)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><UserPlus className="h-3.5 w-3.5" /> Add people</button>
                  <button type="button" onClick={() => setJoining(c)} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Join</button>
                </li>
              ))}
              {!others.length && <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">{q ? "No channels match." : "You're in every channel."}</li>}
            </ul>
          </section>
        )}
      </div>

      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
      {joining && (
        <Dialog open onOpenChange={(o) => !o && setJoining(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogTitle>Join #{joining.name}?</DialogTitle>
            <DialogDescription>Members will see that you joined — a line “{user?.firstName} joined the channel” is posted. Then you can read and write here.</DialogDescription>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setJoining(null)} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
              <button type="button" disabled={join.isPending} onClick={() => join.mutate(joining.uid)} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Join channel</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {adding && <AddPeopleDialog channel={adding} onClose={() => setAdding(null)} onDone={refresh} />}
    </div>
  );
}

/** owners / admins add people to a channel they are not in */
function AddPeopleDialog({ channel, onClose, onDone }: { channel: ManagedChannel; onClose: () => void; onDone: () => void }) {
  const { data: dir } = useDirectory();
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  const people = (dir?.people ?? []).filter((p) => !q.trim() || userName(p.user).toLowerCase().includes(q.trim().toLowerCase()));
  const add = useMutation({
    mutationFn: () => workApi.addChannelMembers(channel.uid, ids),
    onSuccess: () => { toast.success(`Added to #${channel.name}`); onDone(); onClose(); },
    onError: (e) => err(e, "Couldn't add."),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle>Add people to #{channel.name}</DialogTitle>
        <DialogDescription>They will see the whole channel. People already in it are skipped.</DialogDescription>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people" aria-label="Find people" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
        <ul className="max-h-60 overflow-y-auto rounded-lg border border-border p-1">
          {people.map((p) => {
            const on = ids.includes(p.user.id);
            return (
              <li key={p.user.id}>
                <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setIds(on ? ids.filter((x) => x !== p.user.id) : [...ids, p.user.id])} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", on && "bg-primary/[0.06]")}>
                  <Avatar user={p.user} size={20} /> <span className="flex-1 truncate">{userName(p.user)}</span>{on && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
          <button type="button" disabled={!ids.length || add.isPending} onClick={() => add.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Add {ids.length || ""}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
