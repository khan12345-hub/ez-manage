"use client";

/* Custom fields (ClickUp-style): type catalog, create dialog, value editors. */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AtSign,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDollarSign,
  Globe,
  Hash,
  Link2,
  ListTodo,
  Phone,
  Plus,
  Star,
  Tags,
  Trash2,
  Type,
  Users,
  AlignLeft,
  Gauge,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { userName, workApi, type FieldOption, type FieldType, type FieldValues, type WorkField, type WorkUser } from "@/services/work.api";
import { AvatarStack } from "./primitives";
import { AssigneePicker } from "./pickers";

export const FIELD_META: Record<FieldType, { label: string; icon: typeof Type; color: string; popular?: boolean }> = {
  dropdown: { label: "Dropdown", icon: ChevronDown, color: "#16A34A", popular: true },
  text: { label: "Text", icon: Type, color: "#2563EB", popular: true },
  date: { label: "Date", icon: Calendar, color: "#D97706", popular: true },
  textarea: { label: "Text area", icon: AlignLeft, color: "#0EA5E9", popular: true },
  number: { label: "Number", icon: Hash, color: "#0D9488", popular: true },
  labels: { label: "Labels", icon: Tags, color: "#7C3AED", popular: true },
  checkbox: { label: "Checkbox", icon: CheckSquare, color: "#DB2777" },
  email: { label: "Email", icon: AtSign, color: "#DC2626" },
  money: { label: "Money", icon: CircleDollarSign, color: "#16A34A" },
  people: { label: "People", icon: Users, color: "#9333EA" },
  phone: { label: "Phone", icon: Phone, color: "#EA580C" },
  progress: { label: "Progress", icon: Gauge, color: "#2563EB" },
  rating: { label: "Rating", icon: Star, color: "#CA8A04" },
  url: { label: "Website", icon: Globe, color: "#475569" },
};
const TYPES = Object.keys(FIELD_META) as FieldType[];
const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

export const fieldsKey = (spaceId: number) => ["work", "fields", spaceId] as const;
export const listValuesKey = (listId: number) => ["work", "field-values", listId] as const;
export function useSpaceFields(spaceId: number | undefined) {
  return useQuery({ queryKey: fieldsKey(spaceId ?? 0), queryFn: () => workApi.fields(spaceId!), enabled: !!spaceId, staleTime: 30_000 });
}
export function useListFieldValues(listId: number | undefined) {
  return useQuery({ queryKey: listValuesKey(listId ?? 0), queryFn: () => workApi.listFieldValues(listId!), enabled: !!listId });
}

/** Set a value with an instant cache update for the list. */
export function useSetFieldValue(listId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, fieldId, value }: { taskId: number; fieldId: number; value: unknown }) => workApi.setFieldValue(taskId, fieldId, value),
    onMutate: async ({ taskId, fieldId, value }) => {
      const key = listValuesKey(listId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FieldValues>(key);
      qc.setQueryData<FieldValues>(key, (old) => {
        const next = { ...(old ?? {}) };
        const row = { ...(next[taskId] ?? {}) };
        if (value === null || value === "" || (Array.isArray(value) && !value.length)) delete row[fieldId];
        else row[fieldId] = value;
        next[taskId] = row;
        return next;
      });
      return { prev, key };
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toast.error(errMsg(e));
    },
    onSettled: (_r, _e, v) => {
      qc.invalidateQueries({ queryKey: listValuesKey(listId) });
      qc.invalidateQueries({ queryKey: ["work", "task-fields", v.taskId] });
    },
  });
}

const money = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
};

/** Read-only rendering used in table cells. */
export function FieldDisplay({ field, value, members = [] }: { field: WorkField; value: unknown; members?: WorkUser[] }) {
  if (value === undefined || value === null || value === "") return <span className="text-muted-foreground/45">—</span>;
  const opts = field.config?.options ?? [];
  switch (field.type) {
    case "money":
      return <span className="tabular-nums">{money(Number(value), field.config?.currency)}</span>;
    case "number":
      return <span className="tabular-nums">{Number(value).toLocaleString("en-US", { maximumFractionDigits: field.config?.decimals ?? 2 })}</span>;
    case "date":
      return <span>{new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>;
    case "checkbox":
      return <Check className="h-4 w-4 text-primary" />;
    case "rating":
      return <span className="text-[#CA8A04]">{"★".repeat(Number(value))}<span className="text-muted-foreground/30">{"★".repeat(5 - Number(value))}</span></span>;
    case "progress":
      return (
        <span className="flex w-full items-center gap-1.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${value}%` }} /></span>
          <span className="font-mono text-[11px] text-muted-foreground">{String(value)}%</span>
        </span>
      );
    case "dropdown": {
      const o = opts.find((x) => x.id === value);
      return o ? <span className="truncate rounded px-1.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: o.color }}>{o.name}</span> : <span className="text-muted-foreground/45">—</span>;
    }
    case "labels":
      return (
        <span className="flex min-w-0 flex-wrap gap-1">
          {(value as string[]).map((id) => opts.find((x) => x.id === id)).filter(Boolean).map((o) => (
            <span key={o!.id} className="rounded px-1.5 py-px text-[11px] font-semibold" style={{ background: `${o!.color}22`, color: o!.color }}>{o!.name}</span>
          ))}
        </span>
      );
    case "people":
      return <AvatarStack users={members.filter((m) => (value as number[]).includes(m.id))} size={22} />;
    case "url":
      return <a href={String(value)} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-1 truncate text-primary hover:underline"><Link2 className="h-3 w-3 shrink-0" /><span className="truncate">{String(value).replace(/^https?:\/\//, "")}</span></a>;
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

/** Click-to-edit control for one field value (used in cells and the task view). */
export function FieldEditor({ field, value, members = [], disabled, onChange, compact }: { field: WorkField; value: unknown; members?: WorkUser[]; disabled?: boolean; onChange: (v: unknown) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>("");
  useEffect(() => {
    if (open) setDraft(value === undefined || value === null ? "" : field.type === "date" ? String(value).slice(0, 10) : String(value));
  }, [open, value, field.type]);
  const trigger = (
    <button type="button" disabled={disabled} aria-label={field.name} className={cn("flex w-full min-w-0 items-center rounded-md px-1 py-0.5 text-left text-[13px] hover:bg-accent/60 disabled:cursor-default disabled:hover:bg-transparent", compact ? "min-h-[26px]" : "min-h-[30px]")}>
      <FieldDisplay field={field} value={value} members={members} />
    </button>
  );
  if (disabled) return trigger;

  if (field.type === "checkbox") {
    return (
      <input type="checkbox" aria-label={field.name} checked={!!value} onChange={(e) => onChange(e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
    );
  }
  if (field.type === "rating") {
    return (
      <span className="flex" onClick={(e) => e.stopPropagation()}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${field.name}: ${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(Number(value) === n ? null : n)} className={cn("px-px text-[15px] leading-none", Number(value) >= n ? "text-[#CA8A04]" : "text-muted-foreground/30 hover:text-[#CA8A04]/60")}>★</button>
        ))}
      </span>
    );
  }
  if (field.type === "people") {
    return (
      <AssigneePicker members={members} value={members.filter((m) => ((value as number[]) ?? []).includes(m.id))} onChange={(ids) => onChange(ids)}>
        {trigger}
      </AssigneePicker>
    );
  }
  const opts = field.config?.options ?? [];
  const commit = (v: unknown) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <p className="px-1 pb-1.5 text-[11.5px] font-medium text-muted-foreground">{field.name}</p>
        {field.type === "dropdown" || field.type === "labels" ? (
          <div className="max-h-64 overflow-y-auto">
            {opts.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No options yet. Add them in the field settings.</p>}
            {opts.map((o) => {
              const multi = field.type === "labels";
              const cur = (multi ? (value as string[]) ?? [] : [value]) as unknown[];
              const on = cur.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => (multi ? onChange(on ? cur.filter((x) => x !== o.id) : [...cur, o.id]) : commit(on ? null : o.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                >
                  <span className="h-3 w-3 rounded-sm" style={{ background: o.color }} />
                  <span className="flex-1">{o.name}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        ) : field.type === "progress" ? (
          <div className="space-y-2 px-1">
            <input type="range" min={0} max={100} step={5} value={Number(draft || 0)} onChange={(e) => setDraft(e.target.value)} aria-label={field.name} className="w-full accent-[var(--primary)]" />
            <div className="flex items-center justify-between text-[12px]"><span className="font-mono">{draft || 0}%</span><button type="button" onClick={() => commit(Number(draft || 0))} className="rounded-md bg-forest px-2.5 py-1 font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Save</button></div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const d = draft.trim();
              if (!d) return commit(null);
              if (field.type === "number" || field.type === "money") return commit(Number(d));
              if (field.type === "date") return commit(new Date(`${d}T12:00:00`).toISOString());
              if (field.type === "url" && !/^https?:\/\//i.test(d)) return commit(`https://${d}`);
              commit(d);
            }}
          >
            {field.type === "textarea" ? (
              <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} aria-label={field.name} className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-primary/50" />
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                type={field.type === "number" || field.type === "money" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
                step="any"
                placeholder={field.type === "url" ? "https://…" : field.type === "money" ? `Amount (${field.config?.currency ?? "USD"})` : ""}
                aria-label={field.name}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-[13px] outline-none focus:border-primary/50"
              />
            )}
            <div className="flex justify-between">
              <button type="button" onClick={() => commit(null)} className="text-[12px] text-muted-foreground hover:text-foreground">Clear</button>
              <button type="submit" className="rounded-md bg-forest px-2.5 py-1 text-[12px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Save</button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** "+ Create field": pick a type, name it, add options. */
export function CreateFieldDialog({ open, onOpenChange, spaceId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; spaceId: number; onCreated?: (f: WorkField) => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<FieldType | null>(null);
  const [name, setName] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    if (open) {
      setType(null);
      setName("");
      setOptions(["", ""]);
      setCurrency("USD");
    }
  }, [open]);
  const create = useMutation({
    mutationFn: () =>
      workApi.createField(spaceId, {
        name: name.trim(),
        type: type!,
        ...(type === "dropdown" || type === "labels" ? { config: { options: options.filter((o) => o.trim()).map((o) => ({ name: o.trim() })) } } : {}),
        ...(type === "money" ? { config: { currency } } : {}),
      }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: fieldsKey(spaceId) });
      toast.success(`Field "${f.name}" created`);
      onCreated?.(f);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pick = (t: FieldType) => {
    setType(t);
    if (!name) setName(FIELD_META[t].label);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle className="text-[17px] font-semibold">{type ? `New ${FIELD_META[type].label} field` : "Create new field"}</DialogTitle>
        <DialogDescription>{type ? "Available to every list in this space." : "Choose a field type."}</DialogDescription>
        {!type ? (
          <div className="space-y-3">
            {[["Popular", TYPES.filter((t) => FIELD_META[t].popular)], ["All", TYPES.filter((t) => !FIELD_META[t].popular)]].map(([title, list]) => (
              <div key={title as string}>
                <p className="pb-1 text-[12px] font-medium text-muted-foreground">{title as string}</p>
                <div className="grid grid-cols-2 gap-1">
                  {(list as FieldType[]).map((t) => {
                    const M = FIELD_META[t];
                    return (
                      <button key={t} type="button" onClick={() => pick(t)} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-accent">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: M.color }}><M.icon className="h-4 w-4" /></span>
                        {M.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && !create.isPending) create.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Field name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Field name" className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[14px] outline-none focus:border-primary/50" />
            </label>
            {(type === "dropdown" || type === "labels") && (
              <div>
                <span className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Options</span>
                <div className="space-y-1.5">
                  {options.map((o, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50" />
                      <button type="button" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setOptions([...options, ""])} className="flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add option</button>
                </div>
              </div>
            )}
            {type === "money" && (
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-muted-foreground">Currency</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" className="h-9 rounded-md border border-border bg-background px-2 text-[13px]">
                  {["USD", "CAD", "EUR", "GBP", "PKR", "AED", "INR", "AUD"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            )}
            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setType(null)} className="text-[13px] text-muted-foreground hover:text-foreground">← Types</button>
              <button type="submit" disabled={!name.trim() || create.isPending} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">{create.isPending ? "Creating…" : "Create field"}</button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Task view section: every field of the space with its editor. */
export function CustomFieldsSection({ taskId, listId, spaceId, members, canEdit, canManage }: { taskId: number; listId: number; spaceId: number; members: WorkUser[]; canEdit: boolean; canManage: boolean }) {
  const { data: fields = [] } = useSpaceFields(spaceId);
  const { data: values = {} } = useQuery({ queryKey: ["work", "task-fields", taskId], queryFn: () => workApi.taskFieldValues(taskId) });
  const qc = useQueryClient();
  const set = useSetFieldValue(listId);
  const [creating, setCreating] = useState(false);
  if (!fields.length && !canManage) return null;
  return (
    <section className="border-b border-border px-6 py-4" aria-label="Custom fields">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Custom fields</h3>
        <span className="flex-1" />
        {canManage && (
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add field</button>
        )}
      </div>
      {fields.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No custom fields in this space yet.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {fields.map((f) => {
            const M = FIELD_META[f.type];
            return (
              <div key={f.id} className="flex min-h-[36px] items-center gap-3">
                <dt className="flex w-32 shrink-0 items-center gap-2 truncate text-[12.5px] text-muted-foreground" title={f.name}><M.icon className="h-3.5 w-3.5 shrink-0" />{f.name}</dt>
                <dd className="min-w-0 flex-1">
                  <FieldEditor
                    field={f}
                    value={(values as Record<number, unknown>)[f.id]}
                    members={members}
                    disabled={!canEdit}
                    onChange={(v) => {
                      qc.setQueryData(["work", "task-fields", taskId], (old: any) => ({ ...(old ?? {}), [f.id]: v }));
                      set.mutate({ taskId, fieldId: f.id, value: v });
                    }}
                  />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <CreateFieldDialog open={creating} onOpenChange={setCreating} spaceId={spaceId} />
    </section>
  );
}

export { userName };
export type { FieldOption };
