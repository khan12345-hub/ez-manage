"use client";

import { useAuth } from "@/providers/AuthProvider";
import { OnlineDot, useDirectory } from "./people";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Search, Settings2, Trash2, UserPlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRIORITY_META, userName, workApi, type StatusCategory, type WorkPriority, type WorkStatus, type WorkUser } from "@/services/work.api";
import { Avatar, AvatarStack, PriorityFlag, StatusGlyph, fromDateInput, toDateInput } from "./primitives";

const CATEGORY_LABEL = { NOT_STARTED: "Not started", ACTIVE: "Active", DONE: "Done" } as const;
const STATUS_COLORS = ["#6b7280", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9"];

/** Status menu grouped by status group (ClickUp-style); optionally manage (add/rename/recolor/delete). */
export function StatusPicker({
  statuses,
  value,
  onChange,
  disabled,
  children,
  spaceId,
  canManage,
  onChanged,
}: {
  statuses: WorkStatus[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
  children: React.ReactNode;
  spaceId?: number;
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const groups = (["NOT_STARTED", "ACTIVE", "DONE"] as const)
    .map((c) => ({ c, items: statuses.filter((s) => s.category === c) }))
    .filter((g) => g.items.length);
  if (disabled) return <>{children}</>;
  const canEditStatuses = !!spaceId && !!canManage;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setManaging(false); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        {managing && canEditStatuses ? (
          <ManageStatuses statuses={statuses} spaceId={spaceId!} onDone={() => setManaging(false)} onChanged={onChanged} />
        ) : (
          <>
            {groups.map((g) => (
              <div key={g.c} className="py-0.5">
                <p className="px-2 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{CATEGORY_LABEL[g.c]}</p>
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onChange(s.id); setOpen(false); }}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", value === s.id && "bg-accent/70 font-semibold")}
                  >
                    <StatusGlyph status={s} size={14} />
                    <span className="flex-1 truncate uppercase tracking-[0.03em]" style={{ color: s.color }}>{s.name}</span>
                    {value === s.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            ))}
            {canEditStatuses && (
              <button type="button" onClick={() => setManaging(true)} className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                <Settings2 className="h-3.5 w-3.5" /> Add / manage statuses
              </button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ManageStatuses({ statuses, spaceId, onDone, onChanged }: { statuses: WorkStatus[]; spaceId: number; onDone: () => void; onChanged?: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(STATUS_COLORS[1]!);
  const [category, setCategory] = useState<StatusCategory>("ACTIVE");
  const done = () => { qc.invalidateQueries({ queryKey: ["work"] }); onChanged?.(); };
  const add = useMutation({ mutationFn: () => workApi.createStatus(spaceId, { name: name.trim(), color, category }), onSuccess: () => { setName(""); done(); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't add the status.") });
  const edit = useMutation({ mutationFn: (v: { id: number; body: Partial<{ name: string; color: string; category: StatusCategory }> }) => workApi.updateStatus(v.id, v.body), onSuccess: done, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't update.") });
  const del = useMutation({ mutationFn: (id: number) => workApi.deleteStatus(id), onSuccess: done, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete.") });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Manage statuses</p>
        <button type="button" onClick={onDone} className="text-[12px] text-primary hover:underline">Done</button>
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto">
        {statuses.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-accent/60">
            <ColorDot value={s.color} onChange={(c) => edit.mutate({ id: s.id, body: { color: c } })} />
            <input defaultValue={s.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) edit.mutate({ id: s.id, body: { name: v } }); }} aria-label={`Rename ${s.name}`} className="h-7 min-w-0 flex-1 rounded bg-transparent px-1 text-[12.5px] uppercase tracking-[0.03em] outline-none focus:bg-background" style={{ color: s.color }} />
            <select value={s.category} onChange={(e) => edit.mutate({ id: s.id, body: { category: e.target.value as StatusCategory } })} aria-label="Category" className="h-7 rounded bg-transparent text-[11px] text-muted-foreground outline-none">
              <option value="NOT_STARTED">To-do</option><option value="ACTIVE">Active</option><option value="DONE">Done</option>
            </select>
            <button type="button" aria-label={`Delete ${s.name}`} onClick={() => del.mutate(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 border-t border-border pt-2">
        <ColorDot value={color} onChange={setColor} />
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add.mutate(); }} placeholder="New status" aria-label="New status name" className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-[12.5px] outline-none" />
        <select value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)} aria-label="New status category" className="h-7 rounded border border-border bg-background text-[11px]">
          <option value="NOT_STARTED">To-do</option><option value="ACTIVE">Active</option><option value="DONE">Done</option>
        </select>
        <button type="button" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()} aria-label="Add status" className="flex h-7 w-7 items-center justify-center rounded bg-forest text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function ColorDot({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Pick colour" className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: value }} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1.5">
        <div className="grid grid-cols-5 gap-1.5">
          {STATUS_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); }} className={cn("h-5 w-5 rounded-full ring-1 ring-black/10", value === c && "ring-2 ring-foreground")} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PriorityPicker({
  value,
  onChange,
  disabled,
  children,
}: {
  value: WorkPriority | null;
  onChange: (p: WorkPriority | null) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return <>{children}</>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1.5">
        {(Object.keys(PRIORITY_META) as WorkPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent", value === p && "bg-accent/70 font-semibold")}
          >
            <PriorityFlag priority={p} />
            <span className="flex-1 text-left">{PRIORITY_META[p].label}</span>
            {value === p && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
  children,
}: {
  members: WorkUser[];
  value: WorkUser[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "people" | "teams">("all");
  const { user: me } = useAuth();
  const { data: dir } = useDirectory(open);
  const selected = useMemo(() => new Set(value.map((v) => v.id)), [value]);
  const match = (m: WorkUser) => `${userName(m)} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase());
  const chosen = members.filter((m) => selected.has(m.id) && match(m));
  const meRow = members.find((m) => m.id === me?.id && !selected.has(m.id) && match(m));
  const others = members.filter((m) => !selected.has(m.id) && m.id !== me?.id && match(m));
  const eligible = new Set(members.map((m) => m.id));
  const teams = (dir?.teams ?? []).map((t) => ({ ...t, ids: t.memberIds.filter((id) => eligible.has(id)) })).filter((t) => t.ids.length && t.name.toLowerCase().includes(q.toLowerCase()));
  if (disabled) return <>{children}</>;
  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  const toggleTeam = (ids: number[]) => {
    const all = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    for (const id of ids) all ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  const row = (m: WorkUser, label?: string) => (
    <button key={m.id} type="button" onClick={() => toggle(m.id)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent">
      <span className="relative"><Avatar user={m} size={22} />{dir && <OnlineDot online={dir.people.find((p) => p.user.id === m.id)?.online} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label ?? userName(m)}</span>
      {selected.has(m.id) && <Check className="h-3.5 w-3.5 text-primary" />}
    </button>
  );
  const head = (t: string) => <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">{t}</p>;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(""); setTab("all"); } }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div role="tablist" aria-label="Assign to" className="flex gap-1 px-2 pt-2">
          {(["all", "people", "teams"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", tab === t ? "border border-border bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t === "all" ? "All" : t === "people" ? "People" : "Teams"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {tab !== "teams" && (chosen.length > 0 || meRow) && (
            <>
              {head("Assignees")}
              {meRow && row(meRow, "Me")}
              {chosen.map((m) => row(m, m.id === me?.id ? "Me" : undefined))}
            </>
          )}
          {tab !== "teams" && others.length > 0 && (
            <>
              {head("People")}
              {others.map((m) => row(m))}
            </>
          )}
          {tab !== "people" && teams.length > 0 && (
            <>
              {head("Teams")}
              {teams.map((t) => {
                const all = t.ids.every((id) => selected.has(id));
                return (
                  <button key={`t${t.id}`} type="button" onClick={() => toggleTeam(t.ids)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent">
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: t.color }}>{t.name[0]?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground">{t.ids.length}</span>
                    {all && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </>
          )}
          {chosen.length + others.length + (meRow ? 1 : 0) + teams.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No one found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Assignee cell content: avatars or an "add" hint. */
export function AssigneeCell({ users, editable }: { users: WorkUser[]; editable: boolean }) {
  return users.length ? (
    <AvatarStack users={users} size={24} />
  ) : (
    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60", !editable && "opacity-40")}>
      <UserPlus className="h-3 w-3" />
    </span>
  );
}

/** value ISO -> local "HH:MM"; combine a date input + time input into an ISO (noon default when no time) */
export const timeInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const combineDateTime = (date: string, time: string) => (date ? new Date(`${date}T${time || "12:00"}:00`).toISOString() : null);

export function DatePicker({
  value,
  onChange,
  disabled,
  label,
  children,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return <>{children}</>;
  const quick: [string, number][] = [["Today", 0], ["Tomorrow", 1], ["Next week", 7]];
  const dateVal = toDateInput(value);
  const time = timeInput(value);
  const setOffset = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    onChange(combineDateTime(d.toLocaleDateString("en-CA"), time));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-2 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {quick.map(([t, n]) => (
            <button key={t} type="button" onClick={() => setOffset(n)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">{t}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            type="date"
            value={dateVal}
            onChange={(e) => onChange(e.target.value ? combineDateTime(e.target.value, time) : null)}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
            aria-label={label}
          />
          <input
            type="time"
            value={time}
            disabled={!dateVal}
            onChange={(e) => dateVal && onChange(combineDateTime(dateVal, e.target.value))}
            className="h-9 w-[92px] rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50"
            aria-label={`${label} time`}
          />
        </div>
        {value && (
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">
            Clear date
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
