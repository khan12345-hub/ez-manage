"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { workApi } from "@/services/work.api";
import { ceoApi, type CeoPerson } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

/**
 * Message a person from CEO Tower: a Work chat DM sent as the CEO, through Work's own chat
 * (same notifications, same conversation they already have with you). Also used to share a task.
 */
export function MessageDialog({ person, defaultText = "", heading, onClose }: { person: CeoPerson; defaultText?: string; heading?: string; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery({ queryKey: ["ceo-tower", "person", person.id], queryFn: () => ceoApi.person(person.id) });
  const [ws, setWs] = useState<string>("");
  const [text, setText] = useState(defaultText);
  useEffect(() => { if (detail?.reach[0] && !ws) setWs(detail.reach[0].uid); }, [detail, ws]);
  const name = `${person.firstName} ${person.lastName}`.trim();
  const send = useMutation({
    mutationFn: async () => {
      const dm = await workApi.openDm(ws, [person.id]);
      await workApi.sendChat(dm.uid, { content: text.trim() });
      return dm.uid;
    },
    onSuccess: (uid) => {
      toast.success(`Message sent to ${name}`, { action: { label: "Open chat", onClick: () => window.location.assign(`/work/${ws}/chat/${uid}`) } });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't send the message."),
  });
  const reach = detail?.reach ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogTitle className="flex items-center gap-2.5 font-serif text-[21px] font-normal"><Avatar user={person as any} size={30} /> {heading ?? `Message ${name}`}</DialogTitle>
        <DialogDescription>Sent as you in Work chat — it lands in your direct conversation with {person.firstName}.</DialogDescription>
        {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : detail?.isMe ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">That&apos;s you.</p>
        ) : !reach.length ? (
          <p role="alert" className="rounded-lg border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">{person.firstName} isn&apos;t in any of your Work companies, so a message can&apos;t reach them from here. Invite them to Work, or message them in Boards chat.</p>
        ) : (
          <>
            {reach.length > 1 && (
              <label className="text-[12px] font-medium text-muted-foreground">Send through
                <select aria-label="Send through" value={ws} onChange={(e) => setWs(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                  {reach.map((r) => <option key={r.uid} value={r.uid}>{r.name}</option>)}
                </select>
              </label>
            )}
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={`Write to ${person.firstName}…`} aria-label="Message" maxLength={20000}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send.mutate(); }}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary/50" />
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground">Ctrl + Enter to send</span>
              <button type="button" disabled={!text.trim() || !ws || send.isPending} onClick={() => send.mutate()} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><SendHorizontal className="h-3.5 w-3.5" /> Send</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
