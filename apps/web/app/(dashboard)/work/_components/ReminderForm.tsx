"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi } from "@/services/work.api";
import { SnoozePicker } from "../[workspaceId]/inbox/SnoozePicker";
import { Avatar } from "./primitives";
import { remindersKey } from "./Reminders";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

/** Create panel → Reminder tab (ClickUp): name, description, when, for whom. */
export function ReminderForm({ ws, onDone }: { ws: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [at, setAt] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d; });
  const [forId, setForId] = useState<number | null>(null);
  const [whenOpen, setWhenOpen] = useState(false);
  const [forOpen, setForOpen] = useState(false);
  const { data: people } = useQuery({ queryKey: ["work", "people", ws], queryFn: () => workApi.people(ws), enabled: !!ws });
  const members = (people?.members ?? []).map((m) => m.user);
  const target = members.find((m) => m.id === forId);
  const create = useMutation({
    mutationFn: () => workApi.createReminder(ws, { title: title.trim(), description: description.trim() || undefined, remindAt: at.toISOString(), ...(forId && forId !== user?.id ? { assigneeId: forId } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: remindersKey(ws) });
      toast.success(`Reminder set for ${at.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`);
      setTitle("");
      setDescription("");
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const chip = "flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent";

  return (
    <form
      className="px-5 pb-4 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && !create.isPending) create.mutate();
      }}
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reminder name" aria-label="Reminder name" maxLength={200} className="w-full bg-transparent font-serif text-[28px] leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description…" aria-label="Reminder description" rows={2} className="mt-2 w-full resize-none bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Popover open={whenOpen} onOpenChange={setWhenOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="When" className={chip}><AlarmClock className="h-3.5 w-3.5 text-[#b08d57]" />{at.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <SnoozePicker onPick={(d) => { setAt(d); setWhenOpen(false); }} />
          </PopoverContent>
        </Popover>
        <Popover open={forOpen} onOpenChange={setForOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="For" className={chip}>
              {target && target.id !== user?.id ? <><Avatar user={target} size={18} /> For {target.firstName}</> : <><User className="h-3.5 w-3.5" /> For me</>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1">
            {members.map((m) => (
              <button key={m.id} type="button" onClick={() => { setForId(m.id); setForOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <Avatar user={m} size={20} /> <span className="truncate">{m.id === user?.id ? "Me" : userName(m)}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[12px] text-muted-foreground">It arrives in the Inbox at that time.</span>
        <button type="submit" disabled={!title.trim() || create.isPending} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
          {create.isPending ? "Saving…" : "Create Reminder"}
        </button>
      </div>
    </form>
  );
}
