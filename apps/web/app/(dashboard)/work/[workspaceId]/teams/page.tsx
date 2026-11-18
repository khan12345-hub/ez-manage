"use client";

import { Suspense, useMemo, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Check, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon, Network, Plus, Search, Trash2, UserPlus, Users, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userName, WORK_ROLE_META, workApi, type WorkPerson, type WorkRole, type WorkTeam } from "@/services/work.api";
import { PeopleTable } from "../../_components/PeopleTable";
import { Avatar } from "../../_components/primitives";
import { FocusList } from "../../_components/ProfilePanel";
import { OnlineDot, OrgChart, directoryKey, useDirectory, useProfilePanel } from "../../_components/people";
import { SPACE_COLORS } from "../../_components/SpaceIcon";
import { useWorkInvite } from "../../_components/WorkInviteModal";

type Tab = "people" | "teams" | "org" | "analytics";
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "people", label: "All People", icon: Users },
  { id: "teams", label: "All Teams", icon: LayoutGrid },
  { id: "org", label: "Org Chart", icon: Network },
  { id: "analytics", label: "Analytics", icon: Activity },
];
const TONES = ["#4F46E5", "#0891B2", "#047857", "#B08D57", "#DB2777", "#EA580C", "#7C3AED", "#DC2626"];

function TeamsHub() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "people") as Tab;
  const focus = Number(sp.get("focus")) || null;
  const go = (t: Tab, extra = "") => router.replace(`${pathname}?tab=${t}${extra}`, { scroll: false });
  const { data: dir } = useDirectory();
  const { data: people } = useQuery({ queryKey: ["work", "people", ws], queryFn: () => workApi.people(ws) });
  const canManage = !!people?.me.canManage;
  const openProfile = useProfilePanel((s) => s.open);
  const openInvite = useWorkInvite((s) => s.setOpen);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  // All People: card grid or the roles table; filters by role / team / manager
  const view = sp.get("view") === "list" ? "list" : "grid";
  const setView = (v: "grid" | "list") => router.replace(`${pathname}?tab=people${v === "list" ? "&view=list" : ""}`, { scroll: false });
  const [role, setRole] = useState<WorkRole | "">("");
  const [team, setTeam] = useState<number | "">("");
  const [manager, setManager] = useState<number | "">("");
  const [orgMode, setOrgMode] = useState<"classic" | "levels">("classic");
  const keep = (p: WorkPerson) => (!role || p.role === role) && (!team || p.teamIds.includes(team)) && (!manager || p.managerId === manager);

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="px-4 pt-4 sm:px-6">
        <PageHeader icon={UsersRound} title="Teams" count={`${dir?.people.length ?? "…"} people · ${dir?.teams.length ?? "…"} teams`} actions={<>
          {(tab === "people" || tab === "org") && (
            <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 sm:w-56">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "org" ? "Find a person" : "Search people"} aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" />
            </label>
          )}
          {canManage && <button type="button" onClick={() => openInvite(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><UserPlus className="h-4 w-4" /> Invite</button>}
        </>}>
        <nav role="tablist" aria-label="Teams" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)} className={cn("-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 pb-2 text-[13px] font-medium", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </nav>
        </PageHeader>
      </div>

      <div className="flex-1 px-4 py-5 sm:px-6">
        {!dir ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : tab === "people" ? (
          <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value as WorkRole | "")} className="h-8 rounded-full border border-border bg-card px-3 text-[12.5px]">
              <option value="">All roles</option>
              {(Object.keys(WORK_ROLE_META) as WorkRole[]).map((r) => <option key={r} value={r}>{WORK_ROLE_META[r].label}</option>)}
            </select>
            <select aria-label="Filter by team" value={team} onChange={(e) => setTeam(e.target.value ? Number(e.target.value) : "")} className="h-8 rounded-full border border-border bg-card px-3 text-[12.5px]">
              <option value="">All teams</option>
              {dir.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select aria-label="Filter by manager" value={manager} onChange={(e) => setManager(e.target.value ? Number(e.target.value) : "")} className="h-8 rounded-full border border-border bg-card px-3 text-[12.5px]">
              <option value="">Any manager</option>
              {dir.people.filter((m) => dir.people.some((x) => x.managerId === m.user.id)).map((m) => <option key={m.user.id} value={m.user.id}>{userName(m.user)}</option>)}
            </select>
            {(role || team || manager) && <button type="button" onClick={() => { setRole(""); setTeam(""); setManager(""); }} className="text-[12.5px] text-muted-foreground hover:text-foreground">Clear</button>}
            <span className="flex-1" />
            <div role="group" aria-label="Layout" className="flex rounded-lg border border-border bg-card p-0.5">
              <button type="button" aria-pressed={view === "grid"} aria-label="Cards" title="Cards" onClick={() => setView("grid")} className={cn("rounded-md p-1.5", view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground")}><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" aria-pressed={view === "list"} aria-label="List with roles" title="List with roles" onClick={() => setView("list")} className={cn("rounded-md p-1.5", view === "list" ? "bg-accent text-foreground" : "text-muted-foreground")}><ListIcon className="h-4 w-4" /></button>
            </div>
          </div>
          {view === "list" ? <PeopleTable workspaceId={ws} q={q} filter={(id) => { const p = dir.people.find((x) => x.user.id === id); return !p || keep(p); }} /> : (
          <ul aria-label="All People" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
            {dir.people.filter((p) => keep(p) && (!term || `${userName(p.user)} ${p.user.email} ${p.title ?? ""}`.toLowerCase().includes(term))).map((p) => (
              <li key={p.user.id}>
                <button type="button" onClick={() => openProfile(p.user.id)} className="group block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md">
                  {p.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.user.avatarUrl} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center text-[40px] font-bold text-white" style={{ background: `hsl(${Math.round((p.user.id * 137.508) % 360)} 58% 40%)` }}>
                      {(p.user.firstName[0] ?? "") + (p.user.lastName[0] ?? "")}
                    </span>
                  )}
                  <span className="block px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold"><span className="truncate">{userName(p.user)}</span><OnlineDot online={p.online} className="h-2.5 w-2.5 shrink-0 border-0" /></span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{p.title || " "}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          )}
          </div>
        ) : tab === "teams" ? (
          <TeamsGrid ws={ws} canManage={canManage} />
        ) : tab === "org" ? (
          <div className="rounded-xl border border-border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px]">
            {(() => {
              const hit = term ? dir.people.find((p) => userName(p.user).toLowerCase().includes(term)) : null;
              const f = hit?.user.id ?? focus;
              return (
                <>
                  <div className="flex items-center gap-2 p-3">
                    <div role="group" aria-label="Org chart layout" className="flex rounded-lg border border-border bg-card p-0.5 text-[12.5px]">
                      {(["classic", "levels"] as const).map((m) => <button key={m} type="button" aria-pressed={orgMode === m} onClick={() => setOrgMode(m)} className={cn("rounded-md px-3 py-1", orgMode === m ? "bg-accent font-medium" : "text-muted-foreground")}>{m === "classic" ? "Classic" : "By levels"}</button>)}
                    </div>
                    {f && <button type="button" onClick={() => { setQ(""); go("org"); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-[12px] hover:bg-accent">Show everyone</button>}
                  </div>
                  {orgMode === "levels" && !f ? <OrgLevels people={dir.people} onPick={openProfile} /> : <OrgChart dir={dir} focusId={f} onPick={openProfile} />}
                </>
              );
            })()}
          </div>
        ) : (
          <Analytics ws={ws} />
        )}
      </div>
    </div>
  );
}

function TeamsGrid({ ws, canManage }: { ws: string; canManage: boolean }) {
  const { data: dir } = useDirectory();
  const [edit, setEdit] = useState<WorkTeam | "new" | null>(null);
  if (!dir) return null;
  const person = (id: number) => dir.people.find((p) => p.user.id === id);
  return (
    <>
      <ul aria-label="All Teams" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dir.teams.map((t) => {
          const members = t.memberIds.map(person).filter(Boolean) as NonNullable<ReturnType<typeof person>>[];
          return (
            <li key={t.id}>
              <button type="button" onClick={() => setEdit(t)} className="block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md">
                <span className="relative block h-24" style={{ background: `${t.color}26` }}>
                  <span className="absolute -bottom-3.5 left-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-[13px] font-bold text-white" style={{ background: t.color }}>{t.name[0]?.toUpperCase()}</span>
                </span>
                <span className="flex items-end gap-2 px-3 pb-3 pt-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{t.name}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{members.length} {members.length === 1 ? "member" : "members"}</span>
                  </span>
                  <span className="flex -space-x-1.5">{members.slice(0, 4).map((m) => <Avatar key={m.user.id} user={m.user} size={22} />)}</span>
                  {members.length > 4 && <span className="rounded-full bg-muted px-1.5 text-[10.5px]">+{members.length - 4}</span>}
                </span>
              </button>
            </li>
          );
        })}
        {canManage && (
          <li>
            <button type="button" onClick={() => setEdit("new")} className="flex h-full min-h-[170px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground hover:bg-accent/30 hover:text-foreground">
              <Plus className="h-5 w-5" /> New team
            </button>
          </li>
        )}
      </ul>
      {dir.teams.length === 0 && !canManage && <p className="py-12 text-center text-[13px] text-muted-foreground">No teams yet.</p>}
      {edit && <TeamDialog ws={ws} team={edit === "new" ? null : edit} canManage={canManage} onClose={() => setEdit(null)} />}
    </>
  );
}

function TeamDialog({ ws, team, canManage, onClose }: { ws: string; team: WorkTeam | null; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: dir } = useDirectory();
  const openProfile = useProfilePanel((s) => s.open);
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? SPACE_COLORS[6]!);
  const [ids, setIds] = useState<number[]>(team?.memberIds ?? []);
  const [q, setQ] = useState("");
  const done = () => { qc.invalidateQueries({ queryKey: directoryKey(ws) }); onClose(); };
  const save = useMutation({
    mutationFn: () => (team ? workApi.updateTeam(team.id, { name: name.trim(), color, memberIds: ids }) : workApi.createTeam(ws, { name: name.trim(), color, memberIds: ids })),
    onSuccess: () => { toast.success(team ? "Team saved" : "Team created"); done(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't save the team."),
  });
  const remove = useMutation({ mutationFn: () => workApi.deleteTeam(team!.id), onSuccess: () => { toast.success("Team deleted"); done(); } });
  const people = useMemo(() => (dir?.people ?? []).filter((p) => userName(p.user).toLowerCase().includes(q.toLowerCase())), [dir, q]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle>{team ? (canManage ? "Edit team" : team.name) : "New team"}</DialogTitle>
        <DialogDescription className="sr-only">Team name, colour and members</DialogDescription>
        {canManage && (
          <div className="space-y-3">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Client Service" aria-label="Team name" maxLength={60} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
            <div role="radiogroup" aria-label="Team colour" className="flex flex-wrap gap-1.5">
              {SPACE_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: c }}>{color === c && <Check className="h-3.5 w-3.5 text-white" />}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[12.5px] font-medium">Members · {ids.length}</span>
            <span className="flex-1" />
            <label className="flex h-7 w-40 items-center gap-1.5 rounded-md border border-border px-2"><Search className="h-3 w-3 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search members" className="w-full bg-transparent text-[12px] outline-none" /></label>
          </div>
          <ul className="max-h-64 overflow-y-auto rounded-lg border border-border p-1">
            {people.map((p) => {
              const on = ids.includes(p.user.id);
              return (
                <li key={p.user.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40">
                  <button type="button" onClick={() => openProfile(p.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]"><Avatar user={p.user} size={22} /> <span className="truncate">{userName(p.user)}</span></button>
                  {canManage ? (
                    <input type="checkbox" checked={on} onChange={() => setIds(on ? ids.filter((x) => x !== p.user.id) : [...ids, p.user.id])} aria-label={`Member: ${userName(p.user)}`} className="accent-[var(--primary)]" />
                  ) : on ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </li>
              );
            })}
          </ul>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {team && <button type="button" onClick={() => window.confirm(`Delete the team "${team.name}"?`) && remove.mutate()} className="flex items-center gap-1 text-[12.5px] text-destructive hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete team</button>}
            <span className="flex-1" />
            <button type="button" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{team ? "Save" : "Create team"}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Analytics({ ws }: { ws: string }) {
  const openProfile = useProfilePanel((s) => s.open);
  const [day, setDay] = useState(() => new Date());
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const { data } = useQuery({ queryKey: ["work", "analytics", ws, iso], queryFn: () => workApi.analytics(ws, iso) });
  const [show, setShow] = useState<"active" | "idle">("active");
  const shift = (n: number) => setDay((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; });
  const max = Math.max(1, ...(data?.hours ?? [0]));
  const active = data?.people.filter((p) => p.active) ?? [];
  const idle = data?.people.filter((p) => !p.active) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous day" onClick={() => shift(-1)} className="rounded-md border border-border p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next day" onClick={() => shift(1)} className="rounded-md border border-border p-1 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
        <span className="text-[13px] font-medium">{day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        <span className="text-[12px] text-muted-foreground">· who tracked time and what they focused on</span>
      </div>
      <section aria-label="People tracking time by hour" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Number of people tracking time</p>
        <div className="flex h-28 items-end gap-1">
          {(data?.hours ?? Array(24).fill(0)).map((n, h) => (
            <div key={h} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${n} at ${h}:00`}>
              <span className="w-full max-w-[22px] rounded-t bg-primary/80" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 4 : 0 }} />
              <span className="text-[9.5px] text-muted-foreground">{h % 3 === 0 ? `${h % 12 || 12}${h < 12 ? "a" : "p"}` : ""}</span>
            </div>
          ))}
        </div>
      </section>
      <div role="tablist" className="inline-flex rounded-lg border border-border p-0.5 text-[12.5px]">
        <button type="button" role="tab" aria-selected={show === "active"} onClick={() => setShow("active")} className={cn("rounded-md px-3 py-1", show === "active" ? "bg-accent font-medium" : "text-muted-foreground")}>{active.length} Tracked time</button>
        <button type="button" role="tab" aria-selected={show === "idle"} onClick={() => setShow("idle")} className={cn("rounded-md px-3 py-1", show === "idle" ? "bg-accent font-medium" : "text-muted-foreground")}>{idle.length} Didn&apos;t track</button>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {(show === "active" ? active : idle).map((p) => (
          <li key={p.user.id} className="rounded-xl border border-border bg-card p-4">
            <button type="button" onClick={() => openProfile(p.user.id)} className="flex w-full items-center gap-2.5 text-left">
              <span className="relative"><Avatar user={p.user} size={30} /><OnlineDot online={p.online} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" /></span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{userName(p.user)}</span>
            </button>
            <p className="mb-1.5 mt-3 border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">Focused on</p>
            <FocusList rows={p.focused} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={null}>
      <TeamsHub />
    </Suspense>
  );
}

/** Org chart "By levels": everyone in rows by how far they are from the top of the reporting line */
function OrgLevels({ people, onPick }: { people: WorkPerson[]; onPick: (id: number) => void }) {
  const byId = new Map(people.map((p) => [p.user.id, p]));
  const depth = (p: WorkPerson) => { let d = 0, cur = p; const seen = new Set<number>(); while (cur.managerId && byId.has(cur.managerId) && !seen.has(cur.managerId) && d < 20) { seen.add(cur.managerId); cur = byId.get(cur.managerId)!; d++; } return d; };
  const rows = new Map<number, WorkPerson[]>();
  for (const p of people) { const d = depth(p); rows.set(d, [...(rows.get(d) ?? []), p]); }
  return (
    <div className="space-y-5 p-4">
      {[...rows.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => (
        <section key={d} aria-label={`Level ${d + 1}`}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Level {d + 1} · {list.length}</p>
          <div className="flex flex-wrap gap-2.5">
            {list.map((p) => (
              <button key={p.user.id} type="button" onClick={() => onPick(p.user.id)} className="flex w-52 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm hover:shadow-md">
                <span className="relative shrink-0"><Avatar user={p.user} size={30} /><OnlineDot online={p.online} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" /></span>
                <span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{userName(p.user)}</span><span className="block truncate text-[11px] text-muted-foreground">{p.title || WORK_ROLE_META[p.role]?.label}</span></span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
