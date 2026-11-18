"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MailPlus, Trash2, UserCog, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoCompany } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { SourceBadge } from "./bits";
import { PRODUCT_NAME } from "@/lib/products";

const errMsg = (e: any, fallback: string) => e?.response?.data?.message?.toString?.() ?? fallback;
const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer", GUEST: "Guest", LIMITED_MEMBER: "Limited member" };

/**
 * Command Center → Manage people: invite someone to a company, change their role, remove them.
 * Every change goes through Boards' / Work's own people routes as you, so their rules apply
 * (only owners / admins can change people; the owner can't be removed; invites are emailed).
 */
export function ManagePeopleDialog({ companies, defaultKey, onClose }: { companies: CeoCompany[]; defaultKey?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState(defaultKey ?? companies[0]?.key ?? "");
  const { data: co, isLoading } = useQuery({ queryKey: ["ceo-tower", "company-people", key], queryFn: () => ceoApi.companyPeople(key), enabled: !!key });
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [boardIds, setBoardIds] = useState<number[]>([]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ceo-tower", "company-people", key] }); qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ceo-tower" && ["overview", "team"].includes(String(q.queryKey[1])) }); };

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: string }) => co!.source === "work"
      ? api.patch(`/work/workspaces/${co!.uid}/people/${memberId}`, { role })
      : api.patch(`/workspaces/${co!.uid}/members/${memberId}`, { role }),
    onSuccess: () => { refresh(); toast.success("Role changed"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't change the role.")),
  });
  const remove = useMutation({
    mutationFn: (memberId: number) => co!.source === "work"
      ? api.delete(`/work/workspaces/${co!.uid}/people/${memberId}`)
      : api.delete(`/workspaces/${co!.uid}/members/${memberId}`),
    onSuccess: () => { refresh(); toast.success("Removed from the company"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't remove them.")),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.delete(`/work/invites/${id}`),
    onSuccess: () => { refresh(); toast.success("Invitation cancelled"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't cancel it.")),
  });
  const invite = useMutation({
    mutationFn: async () => {
      const list = [...new Set(emails.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
      if (co!.source === "work") { await api.post(`/work/workspaces/${co!.uid}/invites`, { emails: list, role }); return list.length; }
      for (const email of list) await api.post(`/invitation/create`, { email, workspaceId: co!.id, boardIds, role });
      return list.length;
    },
    onSuccess: (n) => { refresh(); setEmails(""); toast.success(`Invited ${n} ${n === 1 ? "person" : "people"}`); },
    onError: (e) => toast.error(errMsg(e, "Couldn't send the invitation.")),
  });

  const emailList = emails.split(/[\s,;]+/).filter(Boolean);
  const validEmails = emailList.length > 0 && emailList.every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const canInvite = !!co && validEmails && (co.source === "work" || boardIds.length > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogTitle className="flex items-center gap-2 font-serif text-[22px] font-normal"><UserCog className="h-5 w-5 text-[#b08d57]" /> Manage people</DialogTitle>
        <DialogDescription>Invite people to a company, change their role or remove them. Changes go through {co?.source === "work" ? PRODUCT_NAME.work : PRODUCT_NAME.boards} itself, so its rules and notifications apply.</DialogDescription>

        <label className="text-[12px] font-medium text-muted-foreground">Company
          <select aria-label="Company" value={key} onChange={(e) => { setKey(e.target.value); setBoardIds([]); }} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name} · {c.source === "work" ? PRODUCT_NAME.work : PRODUCT_NAME.boards}</option>)}
          </select>
        </label>

        {isLoading || !co ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : (
          <>
            {!co.canManage && <p role="note" className="rounded-lg border border-[#b08d57]/40 bg-[#b08d57]/8 px-3 py-2 text-[12.5px]">You aren&apos;t an owner or admin of {co.name}, so changes here will be refused. Ask its owner.</p>}

            <section aria-label="Members" className="rounded-xl border border-border">
              <p className="flex items-center gap-2 border-b border-border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{co.members.length} members <SourceBadge source={co.source} /></p>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {co.members.map((m) => {
                  const owner = m.role === "OWNER";
                  return (
                    <li key={m.memberId} className="flex items-center gap-3 px-4 py-2">
                      <Avatar user={m.user as any} size={28} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{m.user.firstName} {m.user.lastName}</span><span className="block truncate text-[11.5px] text-muted-foreground">{m.user.email}</span></span>
                      {owner ? <span className="rounded-full bg-[#b08d57]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#8a6a35] dark:text-[#d9bd8c]">Owner</span> : (
                        <select aria-label={`Role of ${m.user.firstName} ${m.user.lastName}`} value={m.role} disabled={!co.canManage || changeRole.isPending}
                          onChange={(e) => changeRole.mutate({ memberId: m.memberId, role: e.target.value })} className="h-8 rounded-md border border-border bg-background px-1.5 text-[12.5px]">
                          {co.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                        </select>
                      )}
                      <button type="button" disabled={owner || !co.canManage || remove.isPending} aria-label={`Remove ${m.user.firstName} ${m.user.lastName}`}
                        onClick={() => { if (window.confirm(`Remove ${m.user.firstName} ${m.user.lastName} from ${co.name}? Their work stays; they lose access.`)) remove.mutate(m.memberId); }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ul>
              {co.invites.length > 0 && (
                <ul aria-label="Pending invitations" className="divide-y divide-border border-t border-border">
                  {co.invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                      <MailPlus className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{i.email} <span className="text-muted-foreground">· invited as {ROLE_LABEL[i.role] ?? i.role}</span></span>
                      <button type="button" disabled={!co.canManage || revoke.isPending} onClick={() => revoke.mutate(i.id)} aria-label={`Cancel invitation for ${i.email}`} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11.5px] hover:bg-accent disabled:opacity-40"><X className="h-3 w-3" /> Cancel</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Invite" className={cn("space-y-2 rounded-xl border border-border p-3", !co.canManage && "opacity-60")}>
              <h3 className="text-[12.5px] font-semibold">Invite to {co.name}</h3>
              <div className="flex flex-wrap gap-2">
                <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="name@company.com, other@company.com" aria-label="Emails to invite" className="h-9 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                <select aria-label="Role for new people" value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]">
                  {co.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                </select>
              </div>
              {co.source === "boards" && (
                <div><p className="mb-1 text-[11.5px] text-muted-foreground">Boards they can open (pick at least one)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {co.boards.map((b) => { const on = boardIds.includes(b.id); return (
                      <button key={b.id} type="button" role="checkbox" aria-checked={on} onClick={() => setBoardIds(on ? boardIds.filter((x) => x !== b.id) : [...boardIds, b.id])} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", on ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-accent")}>{b.name}</button>
                    ); })}
                    {!co.boards.length && <span className="text-[12px] text-muted-foreground">This company has no boards yet.</span>}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-muted-foreground">People who already have an account are added right away; others get an email to set up their account.</span>
                <button type="button" disabled={!canInvite || !co.canManage || invite.isPending} onClick={() => invite.mutate()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><MailPlus className="h-4 w-4" /> {invite.isPending ? "Inviting…" : "Invite"}</button>
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
