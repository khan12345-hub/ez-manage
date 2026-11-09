"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Mail, Search, Trash2, UserPlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { userName, WORK_ROLE_META, workApi, type WorkRole } from "@/services/work.api";
import { Avatar } from "../../_components/primitives";
import { ROLE_ICON, useWorkInvite } from "../../_components/WorkInviteModal";

const ASSIGNABLE: Exclude<WorkRole, "OWNER">[] = ["ADMIN", "MEMBER", "LIMITED_MEMBER", "GUEST"];
const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

export default function WorkPeoplePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const openInvite = useWorkInvite((s) => s.setOpen);
  const [q, setQ] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["work", "people", workspaceId], queryFn: () => workApi.people(workspaceId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["work", "people", workspaceId] });
  const change = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Exclude<WorkRole, "OWNER"> }) => workApi.changeRole(workspaceId, userId, role),
    onSuccess: () => { refresh(); toast.success("Role updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (userId: number) => workApi.removePerson(workspaceId, userId),
    onSuccess: () => { refresh(); toast.success("Removed from Work"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => workApi.revokeInvite(id),
    onSuccess: () => { refresh(); toast.success("Invite revoked"); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isError) return <div className="p-10 text-center text-sm text-muted-foreground">You don&apos;t have access to Work in this workspace.</div>;
  const canManage = !!data?.me.canManage;
  const term = q.trim().toLowerCase();
  const members = (data?.members ?? []).filter((m) => !term || `${userName(m.user)} ${m.user.email}`.toLowerCase().includes(term));

  return (
    <div className="flex min-h-full w-full flex-col px-4 py-6 sm:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden /> Work
          </p>
          <h1 className="font-serif text-[34px] leading-tight tracking-tight">People</h1>
          <p className="text-[13px] text-muted-foreground">Who can open Work in this workspace. Boards access is managed separately in Boards.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-9 w-[240px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" />
          </label>
          {canManage && (
            <button type="button" onClick={() => openInvite(true)} className="flex h-9 items-center gap-1.5 rounded-md bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
              <UserPlus className="h-4 w-4" /> Invite
            </button>
          )}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_12px_32px_-20px_rgb(11_42_31/0.25)]">
        <div className="grid grid-cols-[minmax(220px,1fr)_minmax(180px,1fr)_200px_48px] items-center border-b border-border bg-table-head px-5 py-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>Name</span><span>Email</span><span>Role</span><span />
        </div>
        {isLoading && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)}</div>}
        {members.map((m) => {
          const Icon = ROLE_ICON[m.role];
          const editable = canManage && m.role !== "OWNER";
          return (
            <div key={m.user.id} className="group grid grid-cols-[minmax(220px,1fr)_minmax(180px,1fr)_200px_48px] items-center border-b border-border/70 px-5 py-2.5 last:border-b-0 hover:bg-accent/20">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar user={m.user} size={30} />
                <span className="truncate text-[14px] font-medium">{userName(m.user)}</span>
              </span>
              <span className="truncate text-[13px] text-muted-foreground">{m.user.email}</span>
              {editable ? (
                <RolePicker value={m.role} onChange={(role) => change.mutate({ userId: m.user.id, role })} />
              ) : (
                <span className="flex items-center gap-1.5 text-[13px]"><Icon className="h-3.5 w-3.5 text-muted-foreground" /> {WORK_ROLE_META[m.role].label}</span>
              )}
              {editable ? (
                <button type="button" aria-label={`Remove ${userName(m.user)} from Work`} onClick={() => window.confirm(`Remove ${userName(m.user)} from Work? Their Boards access is not affected.`) && remove.mutate(m.user.id)} className="hidden justify-self-end rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : <span />}
            </div>
          );
        })}
      </section>

      {canManage && !!data?.invites.length && (
        <section className="mt-6">
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Pending invites · {data.invites.length}</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {data.invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 border-b border-border/70 px-5 py-2.5 last:border-b-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><Mail className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{inv.email}</span>
                <span className="text-[12.5px] text-muted-foreground">{WORK_ROLE_META[inv.workRole ?? "MEMBER"].label}</span>
                <span className="text-[12px] text-muted-foreground">expires {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <button type="button" onClick={() => revoke.mutate(inv.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <X className="h-3.5 w-3.5" /> Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: WorkRole; onChange: (r: Exclude<WorkRole, "OWNER">) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = ROLE_ICON[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Role: ${WORK_ROLE_META[value].label}`} className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[13px] hover:bg-accent">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {WORK_ROLE_META[value].label} <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {ASSIGNABLE.map((r) => {
          const I = ROLE_ICON[r];
          return (
            <button key={r} type="button" onClick={() => { setOpen(false); if (r !== value) onChange(r); }} className={cn("flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent")}>
              <I className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{WORK_ROLE_META[r].label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{WORK_ROLE_META[r].hint}</span>
              </span>
              {value === r && <Check className="mt-0.5 h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
