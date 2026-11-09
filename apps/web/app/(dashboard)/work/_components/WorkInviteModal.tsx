"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { Check, ChevronDown, Crown, Eye, ShieldCheck, User, UserRoundCog, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WORK_ROLE_META, workApi, type InviteResult, type WorkRole } from "@/services/work.api";

export const useWorkInvite = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

type InvitableRole = Exclude<WorkRole, "OWNER">;
const ROLES: { id: InvitableRole; icon: typeof User }[] = [
  { id: "MEMBER", icon: User },
  { id: "LIMITED_MEMBER", icon: UserRoundCog },
  { id: "GUEST", icon: Eye },
  { id: "ADMIN", icon: ShieldCheck },
];
export const ROLE_ICON: Record<WorkRole, typeof User> = { OWNER: Crown, ADMIN: ShieldCheck, MEMBER: User, LIMITED_MEMBER: UserRoundCog, GUEST: Eye };

const STATUS_TEXT: Record<InviteResult["status"], string> = {
  added: "Added (has an account)",
  invited: "Invite email sent",
  already_member: "Already in Work",
  already_invited: "Invite already pending",
};

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

/** Work's own invite (separate from Boards): Work access only. */
export function WorkInviteModal() {
  const { open, setOpen } = useWorkInvite();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const ws = String(workspaceId ?? "");
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [role, setRole] = useState<InvitableRole>("MEMBER");
  const [roleOpen, setRoleOpen] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const { data: people } = useQuery({ queryKey: ["work", "people", ws], queryFn: () => workApi.people(ws), enabled: open && !!ws });
  const canManage = !!people?.me.canManage;
  const emails = text.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

  const send = useMutation({
    mutationFn: () => workApi.invite(ws, emails, role),
    onSuccess: (r) => {
      setResults(r.results);
      setText("");
      qc.invalidateQueries({ queryKey: ["work", "people", ws] });
      const n = r.results.filter((x) => x.status === "added" || x.status === "invited").length;
      if (n) toast.success(`${n} ${n === 1 ? "person" : "people"} invited to Work`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setResults(null);
      setText("");
    }
  };
  const meta = WORK_ROLE_META[role];
  const Icon = ROLES.find((r) => r.id === role)!.icon;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <div className="px-6 pb-2 pt-5">
          <DialogTitle className="text-[18px] font-semibold">Invite people to Work</DialogTitle>
          <DialogDescription className="mt-0.5 text-[12.5px]">They get access to Work only. Boards access is managed separately.</DialogDescription>
        </div>

        {!canManage && people ? (
          <p className="mx-6 my-4 rounded-lg border border-border bg-muted/40 px-3 py-3 text-[13px] text-muted-foreground">
            Only Work owners and admins can invite people. Ask an admin to add them.
          </p>
        ) : (
          <form
            className="space-y-4 px-6 pb-5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (emails.length && !send.isPending) send.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">Email</span>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter email, comma or space separated"
                aria-label="Emails to invite"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">Invite as</span>
              <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Choose role" className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/60">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[14px] font-semibold">{meta.label} <ChevronDown className="h-3.5 w-3.5 opacity-60" /></span>
                      <span className="block truncate text-[12px] text-muted-foreground">{meta.hint}</span>
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setRole(r.id); setRoleOpen(false); }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent"
                    >
                      <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium">{WORK_ROLE_META[r.id].label}</span>
                        <span className="block text-[12px] text-muted-foreground">{WORK_ROLE_META[r.id].hint}</span>
                      </span>
                      {role === r.id && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {results && (
              <ul className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
                {results.map((r) => (
                  <li key={r.email} className="flex items-center gap-2 text-[12.5px]">
                    {r.status === "added" || r.status === "invited" ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">{r.email}</span>
                    <span className="text-muted-foreground">{STATUS_TEXT[r.status]}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Link href={ws ? `/work/${ws}/people` : "#"} onClick={() => close(false)} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                Manage people
              </Link>
              <button
                type="submit"
                disabled={!emails.length || send.isPending}
                className={cn("h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground")}
              >
                {send.isPending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
