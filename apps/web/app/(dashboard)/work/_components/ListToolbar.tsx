"use client";

import { useMemo } from "react";
import { Check, CheckCircle2, ChevronDown, Columns3, Filter, Layers, ListTree, Plus, RotateCcw, Save, Search, User, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PRIORITY_META, userName, type WorkListDetail, type WorkTag, type WorkTask } from "@/services/work.api";
import { Avatar, PriorityFlag, StatusGlyph } from "./primitives";
import {
  ALL_COLUMNS,
  COLUMN_META,
  DEFAULT_VIEW,
  activeFilterCount,
  cfCol,
  isCf,
  type DueBucket,
  type GroupBy,
  type ViewSettings,
} from "./viewSettings";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "none", label: "None" },
];
const DUE_OPTIONS: { value: DueBucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "later", label: "Later" },
  { value: "none", label: "No due date" },
];

const chip = (active?: boolean) =>
  cn(
    "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors",
    active ? "border-primary/40 bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
  );

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function MenuRow({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

/** List toolbar: Group by, Subtasks, Columns, Filter, Closed, Me mode, Search, Save view. */
export function ListToolbar({
  list,
  tasks,
  view,
  onView,
  dirty,
  onSave,
  onReset,
  q,
  onQ,
  meMode,
  onMeMode,
  showListControls,
  fields = [],
  onCreateField,
}: {
  list: WorkListDetail;
  tasks: WorkTask[];
  view: ViewSettings;
  onView: (v: ViewSettings) => void;
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
  q: string;
  onQ: (q: string) => void;
  meMode: boolean;
  onMeMode: (m: boolean) => void;
  /** group/subtasks/columns only apply to the List view */
  showListControls: boolean;
  fields?: { id: number; name: string; type: string }[];
  /** managers only: open the "Create field" dialog */
  onCreateField?: () => void;
}) {
  const f = view.filters;
  const setFilters = (patch: Partial<ViewSettings["filters"]>) => onView({ ...view, filters: { ...f, ...patch } });
  const nFilters = activeFilterCount(view);
  const tags = useMemo(() => {
    const m = new Map<number, WorkTag>();
    for (const t of tasks) for (const g of t.tags ?? []) m.set(g.id, g);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showListControls && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={chip(view.groupBy !== "status")}>
                <Layers className="h-3.5 w-3.5" /> Group: {GROUP_OPTIONS.find((g) => g.value === view.groupBy)?.label}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Group by</p>
              {GROUP_OPTIONS.map((g) => (
                <button key={g.value} type="button" onClick={() => onView({ ...view, groupBy: g.value, hiddenGroups: [] })} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                  {g.label}
                  {view.groupBy === g.value && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={chip(view.subtasks === "expanded")}>
                <ListTree className="h-3.5 w-3.5" /> Subtasks: {view.subtasks === "expanded" ? "Expanded" : "Collapsed"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              {(["collapsed", "expanded"] as const).map((s) => (
                <button key={s} type="button" onClick={() => onView({ ...view, subtasks: s })} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] capitalize hover:bg-accent">
                  {s}
                  {view.subtasks === s && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={chip()}>
                <Columns3 className="h-3.5 w-3.5" /> Columns
                <span className="font-mono text-[11px] opacity-70">{view.columns.length}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Shown columns</p>
              {ALL_COLUMNS.map((c) => (
                <MenuRow
                  key={c}
                  checked={view.columns.includes(c)}
                  // keep the natural column order whatever the click order
                  onClick={() => {
                    const builtIn = ALL_COLUMNS.filter((x) => (x === c ? !view.columns.includes(c) : view.columns.includes(x)));
                    onView({ ...view, columns: [...builtIn, ...view.columns.filter(isCf)] });
                  }}
                >
                  {COLUMN_META[c].label}
                </MenuRow>
              ))}
              <p className="mt-1 border-t border-border/70 px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Custom fields</p>
              {fields.length === 0 && <p className="px-2 py-1 text-[12px] text-muted-foreground">None in this space yet.</p>}
              {fields.map((f) => {
                const key = cfCol(f.id);
                const on = view.columns.includes(key);
                return (
                  <MenuRow key={key} checked={on} onClick={() => onView({ ...view, columns: on ? view.columns.filter((x) => x !== key) : [...view.columns, key] })}>
                    {f.name}
                  </MenuRow>
                );
              })}
              {onCreateField && (
                <button type="button" onClick={onCreateField} className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" /> Create field
                </button>
              )}
            </PopoverContent>
          </Popover>
        </>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={chip(nFilters > 0)}>
            <Filter className="h-3.5 w-3.5" /> Filter
            {nFilters > 0 && <span className="rounded bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{nFilters}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[70vh] w-[300px] overflow-y-auto p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[13px] font-semibold">Filters</span>
            {nFilters > 0 && (
              <button type="button" onClick={() => onView({ ...view, filters: DEFAULT_VIEW.filters })} className="text-[12px] text-muted-foreground hover:text-foreground">
                Clear all
              </button>
            )}
          </div>
          <FilterSection title="Status">
            {list.statuses.map((s) => (
              <MenuRow key={s.id} checked={f.statusIds.includes(s.id)} onClick={() => setFilters({ statusIds: toggle(f.statusIds, s.id) })}>
                <StatusGlyph status={s} size={13} /> {s.name}
              </MenuRow>
            ))}
          </FilterSection>
          <FilterSection title="Assignee">
            <MenuRow checked={f.assigneeIds.includes(0)} onClick={() => setFilters({ assigneeIds: toggle(f.assigneeIds, 0) })}>
              <span className="text-muted-foreground">Unassigned</span>
            </MenuRow>
            {list.members.map((m) => (
              <MenuRow key={m.id} checked={f.assigneeIds.includes(m.id)} onClick={() => setFilters({ assigneeIds: toggle(f.assigneeIds, m.id) })}>
                <Avatar user={m} size={18} /> <span className="truncate">{userName(m)}</span>
              </MenuRow>
            ))}
          </FilterSection>
          <FilterSection title="Priority">
            {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => (
              <MenuRow key={p} checked={f.priorities.includes(p)} onClick={() => setFilters({ priorities: toggle(f.priorities, p) })}>
                <PriorityFlag priority={p} showLabel />
              </MenuRow>
            ))}
            <MenuRow checked={f.priorities.includes("NONE")} onClick={() => setFilters({ priorities: toggle(f.priorities, "NONE") })}>
              <span className="text-muted-foreground">No priority</span>
            </MenuRow>
          </FilterSection>
          <FilterSection title="Due date">
            {DUE_OPTIONS.map((d) => (
              <MenuRow key={d.value} checked={f.due.includes(d.value)} onClick={() => setFilters({ due: toggle(f.due, d.value) })}>
                {d.label}
              </MenuRow>
            ))}
          </FilterSection>
          {tags.length > 0 && (
            <FilterSection title="Tags">
              {tags.map((t) => (
                <MenuRow key={t.id} checked={f.tagIds.includes(t.id)} onClick={() => setFilters({ tagIds: toggle(f.tagIds, t.id) })}>
                  <span className="rounded px-1.5 py-px text-[11px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
                </MenuRow>
              ))}
            </FilterSection>
          )}
        </PopoverContent>
      </Popover>

      <label className={cn(chip(!view.showClosed), "cursor-pointer")}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Closed
        <Switch aria-label="Show closed tasks" checked={view.showClosed} onCheckedChange={(v) => onView({ ...view, showClosed: v })} className="scale-75" />
      </label>

      <button type="button" aria-pressed={meMode} onClick={() => onMeMode(!meMode)} className={chip(meMode)}>
        <User className="h-3.5 w-3.5" /> Me mode
      </button>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex h-8 w-[220px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => onQ("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        {dirty && (
          <button type="button" onClick={onReset} title="Discard changes to this view" className={chip()}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors",
            dirty ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "border border-border bg-card text-muted-foreground opacity-70",
          )}
        >
          <Save className="h-3.5 w-3.5" /> {dirty ? "Save view" : "View saved"}
        </button>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/70 py-1.5 first-of-type:border-t-0">
      <p className="px-2 pb-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
