"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Mail, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";

const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text); toast.success(`${what} copied`); };

/** List header → Share: copy the team link, or turn on a public read-only link (and off again). */
export function ShareListButton({ listId, listUid, ws, canEdit }: { listId: number; listUid: string; ws: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent"><Share2 className="h-4 w-4" /> Share</button>
      {open && <ShareListDialog listId={listId} listUid={listUid} ws={ws} canEdit={canEdit} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareListDialog({ listId, listUid, ws, canEdit, onClose }: { listId: number; listUid: string; ws: string; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["work", "list-share", listId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ token: string | null }>(`/work/lists/${listId}/share`)).data });
  const on = useMutation({ mutationFn: async () => (await api.post<{ token: string }>(`/work/lists/${listId}/share`)).data, onSuccess: (d) => qc.setQueryData(key, d), onError: (e) => toast.error(errMsg(e, "Couldn't create the link.")) });
  const off = useMutation({ mutationFn: () => api.delete(`/work/lists/${listId}/share`), onSuccess: () => { qc.setQueryData(key, { token: null }); toast.success("Public link turned off"); } });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const team = `${origin}/work/${ws}/list/${listUid}`;
  const pub = data?.token ? `${origin}/wl/${data.token}` : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" /> Share this list</DialogTitle>
        <DialogDescription>People in this workspace open it with the team link. A public link shows a read-only copy to anyone who has it.</DialogDescription>
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3">
            <p className="text-[12.5px] font-semibold">Team link</p>
            <div className="mt-1.5 flex gap-2"><input readOnly value={team} aria-label="Team link" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 text-[12.5px]" /><button type="button" onClick={() => copy(team, "Link")} className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12.5px] hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy</button></div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Link2 className="h-3.5 w-3.5" /> Public read-only link</p>
            {pub ? (
              <>
                <div className="mt-1.5 flex gap-2"><input readOnly value={pub} aria-label="Public link" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 text-[12.5px]" /><button type="button" onClick={() => copy(pub, "Public link")} className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12.5px] hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy</button></div>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">Shows task names, status, due dates and first names — no comments or files.</p>
                {canEdit && <button type="button" onClick={() => off.mutate()} className="mt-2 text-[12.5px] font-medium text-destructive hover:underline">Turn off the public link</button>}
              </>
            ) : canEdit ? (
              <button type="button" disabled={on.isPending} onClick={() => on.mutate()} className="mt-2 h-9 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">Create public link</button>
            ) : <p className="mt-1 text-[12px] text-muted-foreground">Only people who can edit this list can create one.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Channel settings → Email to this channel: the channel's own address (emails arrive as messages). */
export function ChannelEmail({ uid }: { uid: string }) {
  const qc = useQueryClient();
  const key = ["work", "channel-email", uid];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ address: string | null; token: string | null; configured: boolean }>(`/work/chat/channels/${uid}/email`)).data });
  const make = useMutation({ mutationFn: async () => (await api.post(`/work/chat/channels/${uid}/email`)).data, onSuccess: (d) => qc.setQueryData(key, d), onError: (e) => toast.error(errMsg(e, "Couldn't create the address.")) });
  const off = useMutation({ mutationFn: () => api.delete(`/work/chat/channels/${uid}/email`), onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Email address turned off"); } });
  if (!data) return null;
  return (
    <section aria-label="Email to this channel" className="rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Mail className="h-3.5 w-3.5" /> Email to this channel</p>
      {!data.configured ? (
        <p className="mt-1 text-[12px] text-muted-foreground">Needs an inbound email service on the server (INBOUND_EMAIL_DOMAIN and INBOUND_EMAIL_SECRET).</p>
      ) : data.address ? (
        <>
          <div className="mt-1.5 flex gap-1.5"><input readOnly value={data.address} aria-label="Channel email address" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 text-[12px]" /><button type="button" aria-label="Copy address" onClick={() => copy(data.address!, "Address")} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"><Copy className="h-3.5 w-3.5" /></button></div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">Emails sent here appear in the channel. Anyone with the address can post — turn it off if it leaks.</p>
          <button type="button" onClick={() => off.mutate()} className="mt-1.5 text-[12px] font-medium text-destructive hover:underline">Turn off this address</button>
        </>
      ) : (
        <button type="button" disabled={make.isPending} onClick={() => make.mutate()} className="mt-2 h-8 rounded-md border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50">Get an email address</button>
      )}
    </section>
  );
}
