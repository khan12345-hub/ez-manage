"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ceoApi } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { PeoplePicker } from "./PeoplePicker";

const msg = (e: any, fallback: string) => e?.response?.data?.message?.toString?.() ?? fallback;

/**
 * CEO Tower → Access: an owner shares CEO Tower with people in their companies.
 * They see the owner's companies (nothing else) and can't share it further.
 */
export function ShareAccessDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: shared = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "shared-with"], queryFn: ceoApi.sharedWith });
  const [pick, setPick] = useState<number[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["ceo-tower", "shared-with"] });

  const share = useMutation({
    mutationFn: async () => {
      const failed: string[] = [];
      for (const id of pick) await ceoApi.share(id).catch((e) => failed.push(msg(e, "Couldn't share.")));
      return { done: pick.length - failed.length, failed };
    },
    onSuccess: ({ done, failed }) => {
      refresh();
      setPick([]);
      if (done) toast.success(`CEO Tower shared with ${done} ${done === 1 ? "person" : "people"}`);
      if (failed.length) toast.error([...new Set(failed)].join(" "));
    },
  });
  const unshare = useMutation({
    mutationFn: (userId: number) => ceoApi.unshare(userId),
    onSuccess: () => { refresh(); toast.success("Access removed"); },
    onError: (e: any) => toast.error(msg(e, "Couldn't remove access.")),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogTitle className="flex items-center gap-2 font-serif text-[22px] font-normal"><KeyRound className="h-5 w-5 text-[#b08d57]" /> Share CEO Tower</DialogTitle>
        <DialogDescription>
          People you add see CEO Tower for <strong>your companies only</strong> and can message, assign and schedule within them. They can&apos;t share it with anyone else. You can take access back at any time.
        </DialogDescription>

        <section aria-label="People with access" className="rounded-xl border border-border">
          <p className="border-b border-border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Has access</p>
          {isLoading ? <div className="h-16 animate-pulse bg-muted" /> : !shared.length ? (
            <p className="px-4 py-5 text-center text-[13px] text-muted-foreground">Only you. Add someone below.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shared.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar user={g.user as any} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{g.user.firstName} {g.user.lastName}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{g.user.email} · since {new Date(g.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  </span>
                  <button type="button" onClick={() => unshare.mutate(g.user.id)} disabled={unshare.isPending} aria-label={`Remove access for ${g.user.firstName} ${g.user.lastName}`}
                    className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] text-muted-foreground hover:border-destructive/40 hover:text-destructive">
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-2">
          <PeoplePicker value={pick} onChange={setPick} label="Add people" />
          <div className="flex justify-end">
            <button type="button" disabled={!pick.length || share.isPending} onClick={() => share.mutate()}
              className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
              {share.isPending ? "Sharing…" : `Give access${pick.length ? ` (${pick.length})` : ""}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
