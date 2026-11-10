"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { Clock3, Mail, UserRound, Users } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { userName, workApi, type WorkDirectory, type WorkPerson, type WorkUser } from "@/services/work.api";
import { Avatar } from "./primitives";

/** which profile is open in the side panel */
export const useProfilePanel = create<{ userId: number | null; open: (id: number) => void; close: () => void }>((set) => ({
  userId: null,
  open: (userId) => set({ userId }),
  close: () => set({ userId: null }),
}));

export const directoryKey = (ws: string) => ["work", "directory", ws] as const;
export function useDirectory(enabled = true) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = workspaceId ?? "";
  return useQuery({ queryKey: directoryKey(ws), queryFn: () => workApi.directory(ws), enabled: enabled && !!ws, staleTime: 60_000 });
}

/** "4:37 pm | 9h behind" for someone's time zone */
export function localTime(tz: string | null | undefined) {
  if (!tz) return null;
  try {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).toLowerCase();
    const there = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const here = new Date(now.toLocaleString("en-US"));
    const diff = Math.round((there.getTime() - here.getTime()) / 3600e3);
    return `${time}${diff ? ` | ${Math.abs(diff)}h ${diff > 0 ? "ahead" : "behind"}` : " local time"}`;
  } catch {
    return null;
  }
}

export function OnlineDot({ online, className }: { online?: boolean; className?: string }) {
  return <span aria-label={online ? "Online" : "Offline"} className={cn("block rounded-full border-2 border-card", online ? "bg-emerald-500" : "bg-muted-foreground/40", className)} />;
}

export function personOf(dir: WorkDirectory | undefined, id: number) {
  return dir?.people.find((p) => p.user.id === id);
}

/** Hover a person (avatar or name) → card with email, local time, teams, "View profile". */
export function PersonHover({ user, children, side = "bottom" }: { user: WorkUser; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  const openProfile = useProfilePanel((s) => s.open);
  const { data: dir } = useDirectory();
  const p: WorkPerson | undefined = personOf(dir, user.id);
  const teams = dir?.teams.filter((t) => p?.teamIds.includes(t.id)) ?? [];
  const lt = localTime(p?.timezone);
  return (
    <HoverCard openDelay={350} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align="start" className="w-72 p-0">
        <div className="flex items-start gap-3 p-4">
          <span className="relative">
            <Avatar user={user} size={56} />
            <OnlineDot online={p?.online} className="absolute bottom-0 right-0 h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{userName(user)}</span>
            {p?.title && <span className="block truncate text-[12.5px] text-muted-foreground">{p.title}</span>}
            <button type="button" onClick={() => openProfile(user.id)} className="mt-2 flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] font-medium hover:bg-accent">
              <UserRound className="h-3.5 w-3.5" /> View profile
            </button>
          </span>
        </div>
        <ul className="space-y-1.5 border-t border-border px-4 py-3 text-[12.5px]">
          {user.email && <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> <span className="truncate">{user.email}</span></li>}
          {lt && <li className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-muted-foreground" /> {lt}</li>}
          {teams.length > 0 && <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> {teams.map((t) => t.name).join(", ")}</li>}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Classic org chart: manager chain above, the person, their reports below. Whole tree when `focusId` is null. */
export function OrgChart({ dir, focusId, onPick, compact = false }: { dir: WorkDirectory; focusId: number | null; onPick: (id: number) => void; compact?: boolean }) {
  const byId = new Map(dir.people.map((p) => [p.user.id, p]));
  const kids = (id: number) => dir.people.filter((p) => p.managerId === id);
  const node = (p: WorkPerson, focus = false) => (
    <button
      key={p.user.id}
      type="button"
      onClick={() => onPick(p.user.id)}
      className={cn("flex w-52 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md", focus ? "border-foreground ring-1 ring-foreground" : "border-border")}
    >
      <span className="relative shrink-0">
        <Avatar user={p.user} size={32} />
        <OnlineDot online={p.online} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold">{userName(p.user)}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{p.title || "—"}</span>
      </span>
    </button>
  );
  const Line = () => <span aria-hidden className="mx-auto block h-6 w-px bg-border" />;

  if (focusId != null) {
    const me = byId.get(focusId);
    if (!me) return null;
    const chain: WorkPerson[] = [];
    let cur = me.managerId ? byId.get(me.managerId) : undefined;
    for (let i = 0; cur && i < (compact ? 2 : 20); i++) {
      chain.unshift(cur);
      cur = cur.managerId ? byId.get(cur.managerId) : undefined;
    }
    const reports = kids(focusId);
    return (
      <div className="flex flex-col items-center py-6" aria-label="Reporting line">
        {chain.map((c) => (
          <div key={c.user.id} className="flex flex-col items-center">{node(c)}<Line /></div>
        ))}
        {node(me, true)}
        {reports.length > 0 && (
          <>
            <Line />
            <div className={cn("flex flex-wrap justify-center gap-3", reports.length > 1 && "border-t border-border pt-4")}>{reports.map((r) => node(r))}</div>
          </>
        )}
      </div>
    );
  }

  // full tree: roots are people with no (known) manager who manage someone; the rest sit under "No manager"
  const roots = dir.people.filter((p) => (!p.managerId || !byId.has(p.managerId)) && kids(p.user.id).length > 0);
  const loose = dir.people.filter((p) => (!p.managerId || !byId.has(p.managerId)) && kids(p.user.id).length === 0);
  const branch = (p: WorkPerson, depth: number): React.ReactNode => {
    const ks = kids(p.user.id);
    return (
      <div key={p.user.id} className="flex flex-col items-center">
        {node(p)}
        {ks.length > 0 && depth < 12 && (
          <>
            <Line />
            <div className={cn("flex items-start gap-4", ks.length > 1 && "border-t border-border pt-4")}>{ks.map((k) => branch(k, depth + 1))}</div>
          </>
        )}
      </div>
    );
  };
  return (
    <div className="flex items-start gap-12 overflow-x-auto p-6" aria-label="Org chart">
      {roots.map((r) => branch(r, 0))}
      {loose.length > 0 && (
        <div className="flex w-56 shrink-0 flex-col gap-2">
          <span className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">No manager · {loose.length}</span>
          {loose.map((p) => node(p))}
        </div>
      )}
    </div>
  );
}
