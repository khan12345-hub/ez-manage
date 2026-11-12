"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { workApi, type WorkPriority } from "@/services/work.api";
import { getBoardDetail, getBoardMembers } from "@/services/boards.api";
import { ceoApi, type CeoCompany } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { SourceBadge } from "./bits";

const PRIORITIES: { v: WorkPriority | ""; label: string }[] = [{ v: "", label: "No priority" }, { v: "URGENT", label: "Urgent" }, { v: "HIGH", label: "High" }, { v: "NORMAL", label: "Normal" }, { v: "LOW", label: "Low" }];
type Person = { id: number; firstName: string; lastName: string; avatarUrl?: string | null };
const SELECT = "mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground";

/**
 * "Assign task" from CEO Tower, for Work and Boards companies. The task is made through each
 * product's own API (its permissions, notifications and automations apply as if made there):
 * Work → a task in a list; Boards → a task in a board group, with its Person / Date cells set.
 */
export function AssignTaskDialog({ companies, defaultCompany, defaultAssignee, onClose }: { companies: CeoCompany[]; people: unknown[]; defaultCompany: string | null; defaultAssignee?: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState(defaultCompany ?? companies[0]?.key ?? "");
  const co = companies.find((c) => c.key === key);
  const isWork = co?.source === "work";
  const [listId, setListId] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<number[]>(defaultAssignee ? [defaultAssignee] : []);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<WorkPriority | "">("HIGH");

  // Work: lists + people of the company
  const { data: tree } = useQuery({ queryKey: ["work", "tree", co?.uid], queryFn: () => workApi.tree(co!.uid), enabled: !!co && isWork });
  const { data: dir } = useQuery({ queryKey: ["work", "directory", co?.uid], queryFn: () => workApi.directory(co!.uid), enabled: !!co && isWork });
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  // Boards: boards of the company, then the board's groups, columns and members
  const { data: structure } = useQuery({ queryKey: ["ceo-tower", "structure", "boards", key], queryFn: () => ceoApi.structure("boards", key), enabled: !!co && !isWork });
  const boards: { id: number; name: string }[] = structure?.[0]?.boards ?? [];
  const { data: board } = useQuery({ queryKey: ["ceo-assign-board", boardId], queryFn: () => getBoardDetail(boardId!), enabled: !!boardId });
  const { data: boardPeople } = useQuery({ queryKey: ["ceo-assign-board-members", boardId], queryFn: () => getBoardMembers(boardId!), enabled: !!boardId });
  useEffect(() => { if (board?.groups?.length && !groupId) setGroupId(board.groups[0].id); }, [board, groupId]);

  const people: Person[] = isWork ? (dir?.people ?? []).filter((p) => p.role !== "GUEST" || assignees.includes(p.user.id)).map((p) => p.user) : (boardPeople ?? []);
  const loaded = isWork ? !!dir : !!boardPeople;
  // someone preselected who can't be assigned here is dropped
  useEffect(() => { if (loaded) setAssignees((a) => a.filter((id) => people.some((p) => p.id === id))); }, [loaded, key, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: async () => {
      if (isWork) {
        const t = await workApi.createTask(listId!, {
          name: name.trim(), assigneeIds: assignees, ...(description.trim() ? { description: description.trim() } : {}),
          ...(due ? { dueDate: new Date(`${due}T17:00:00`).toISOString() } : {}), ...(priority ? { priority } : {}),
        });
        return t.name;
      }
      // Boards: create in the group, then fill its first Person and Date columns like a person would
      const t = (await api.post(`/boards/${boardId}/tasks`, { groupId, name: name.trim() })).data;
      const cols: { id: number; type: string }[] = board?.columns ?? [];
      const personCol = cols.find((c) => c.type === "PERSON");
      const dateCol = cols.find((c) => c.type === "DATE");
      const cellOf = (colId?: number) => (t.cells ?? []).find((c: any) => c.columnId === colId);
      const chosen = people.filter((p) => assignees.includes(p.id)).map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }));
      if (chosen.length) {
        const cell = cellOf(personCol?.id);
        if (!cell) throw new Error("This board has no Person column to assign people.");
        await api.patch(`/boards/${boardId}/cells/${cell.id}`, { value: { users: chosen } });
      }
      if (due && dateCol) {
        const cell = cellOf(dateCol.id);
        if (cell) await api.patch(`/boards/${boardId}/cells/${cell.id}`, { value: { date: due } });
      }
      return t.name as string;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["ceo-tower"] });
      toast.success(`Task assigned: ${n}`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? e?.message ?? "Couldn't create the task."),
  });
  const ready = !!name.trim() && assignees.length > 0 && (isWork ? !!listId : !!boardId && !!groupId);
  const hasDate = isWork || (board?.columns ?? []).some((c: any) => c.type === "DATE");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle className="font-serif text-[22px] font-normal">Assign a task</DialogTitle>
        <DialogDescription>{isWork ? "It is created in Work, in the list you pick, and the people get notified as usual." : "It is created on the board you pick, with the people and date filled in — exactly as if added in Boards."}</DialogDescription>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-medium text-muted-foreground">Company
              <select aria-label="Company" value={key} onChange={(e) => { setKey(e.target.value); setListId(null); setBoardId(null); setGroupId(null); setAssignees([]); }} className={SELECT}>
                {companies.map((c) => <option key={c.key} value={c.key}>{c.name} ({c.source === "work" ? "Work" : "Boards"})</option>)}
              </select>
            </label>
            {isWork ? (
              <label className="text-[12px] font-medium text-muted-foreground">List
                <select aria-label="List" value={listId ?? ""} onChange={(e) => setListId(Number(e.target.value) || null)} className={SELECT}>
                  <option value="">{tree ? "Choose a list…" : "Loading…"}</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-[12px] font-medium text-muted-foreground">Board
                <select aria-label="Board" value={boardId ?? ""} onChange={(e) => { setBoardId(Number(e.target.value) || null); setGroupId(null); }} className={SELECT}>
                  <option value="">{structure ? "Choose a board…" : "Loading…"}</option>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {!isWork && boardId && (
            <label className="text-[12px] font-medium text-muted-foreground">Group
              <select aria-label="Group" value={groupId ?? ""} onChange={(e) => setGroupId(Number(e.target.value) || null)} className={SELECT}>
                {(board?.groups ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="What needs to happen?" aria-label="Task name" maxLength={500} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
          {isWork && <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" aria-label="Details" rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />}
          <div>
            <p className="mb-1 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">Assign to {co && <SourceBadge source={co.source} />}{!isWork && <span className="font-normal">board members</span>}</p>
            <ul aria-label="Assign to" className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {people.map((p) => {
                const on = assignees.includes(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => setAssignees(on ? assignees.filter((x) => x !== p.id) : [...assignees, p.id])} className={cn("flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[12.5px] ring-1", on ? "bg-primary/10 font-semibold ring-primary/40" : "ring-border hover:bg-accent")}>
                      <Avatar user={p as any} size={20} /> {p.firstName} {p.lastName}{on && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  </li>
                );
              })}
              {!people.length && <li className="text-[12px] text-muted-foreground">{!isWork && !boardId ? "Pick a board first." : loaded ? "No people here yet." : "Loading people…"}</li>}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hasDate && (
              <label className="text-[12px] font-medium text-muted-foreground">Due date
                <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className={SELECT} />
              </label>
            )}
            {isWork && (
              <label className="text-[12px] font-medium text-muted-foreground">Priority
                <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkPriority | "")} className={SELECT}>
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">{ready ? "" : isWork ? "Pick a list, a name and at least one person." : "Pick a board, a name and at least one person."}</span>
          <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Assign task</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
