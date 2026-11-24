"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Plus, Search, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { crmApi, crmKeys, fmtMoney, type CrmDeal, type CrmStage, type ListQuery, type Page } from "@/services/crm.api";
import { btnGhost, btnPrimary, fmtDate, input, isPast, onErr, useCrmWs } from "../_lib/crm";
import { Avatar, Empty } from "./bits";
import { CreateRecord } from "./CreateRecord";

/** Deals as a board: one column per stage, drag a card to move it (Lost asks why) */
export function DealBoard({ pipelineId, owner, q }: { pipelineId: number; owner: string; q: string }) {
  const { uid, ws } = useCrmWs();
  const qc = useQueryClient();
  const reduced = useReducedMotion();
  const query: ListQuery = { view: "board", pipelineId, owner, q };
  const key = crmKeys.list(uid, "deal", query);
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => crmApi.list<CrmDeal>(uid, "deal", query), enabled: !!uid && !!pipelineId });
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ stageId: number; beforeId: number | null } | null>(null);
  const [lost, setLost] = useState<{ id: number; stageId: number; beforeId: number | null } | null>(null);
  const [reason, setReason] = useState("");
  const [create, setCreate] = useState<number | null>(null);
  const pipeline = ws?.pipelines.find((p) => p.id === pipelineId);
  const stages = pipeline?.stages ?? [];
  const cur = ws?.currency ?? "USD";
  const can = !!ws?.canEdit;

  const move = useMutation({
    mutationFn: (m: { id: number; stageId: number; beforeId: number | null; lostReason?: string }) => crmApi.moveDeal(uid, m.id, { stageId: m.stageId, beforeId: m.beforeId, lostReason: m.lostReason }),
    onMutate: async (m) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Page<CrmDeal>>(key);
      if (prev) {
        const st = stages.find((s) => s.id === m.stageId)!;
        const moving = prev.rows.find((r) => r.id === m.id);
        if (moving) {
          const rest = prev.rows.filter((r) => r.id !== m.id);
          const moved = { ...moving, stageId: m.stageId, stage: { id: st.id, name: st.name, probability: st.probability, isWon: st.isWon, isLost: st.isLost } };
          const idx = m.beforeId ? rest.findIndex((r) => r.id === m.beforeId) : -1;
          if (idx >= 0) rest.splice(idx, 0, moved); else rest.push(moved);
          qc.setQueryData(key, { ...prev, rows: rest });
        }
      }
      return { prev };
    },
    onError: (e, _m, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); onErr("Couldn't move the deal.")(e); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm", uid] }),
  });

  const byStage = useMemo(() => {
    const m = new Map<number, CrmDeal[]>();
    for (const s of stages) m.set(s.id, []);
    for (const d of data?.rows ?? []) m.get(d.stageId)?.push(d);
    return m;
  }, [data, stages]);

  const drop = (stage: CrmStage) => {
    if (drag === null) return;
    const beforeId = over?.stageId === stage.id ? over.beforeId : null;
    const d = data?.rows.find((r) => r.id === drag);
    setDrag(null); setOver(null);
    if (!d || (d.stageId === stage.id && beforeId === null && byStage.get(stage.id)?.at(-1)?.id === d.id)) return;
    if (stage.isLost && d.stageId !== stage.id) { setLost({ id: d.id, stageId: stage.id, beforeId }); return; }
    move.mutate({ id: d.id, stageId: stage.id, beforeId });
  };

  if (isLoading) return <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[460px] w-[272px] shrink-0 animate-pulse rounded-[20px] bg-black/[0.05] dark:bg-white/[0.06]" />)}</div>;
  if (!stages.length) return <Empty icon={Search} title="No stages" body="Add stages to this pipeline in Settings." />;

  return (
    <>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Pipeline stages">
        {stages.map((s, si) => {
          const list = byStage.get(s.id) ?? [];
          const total = list.reduce((n, d) => n + d.amount, 0);
          const tone = s.isWon ? "#047857" : s.isLost ? "#dc2626" : "#2563eb";
          return (
            <motion.section key={s.id} role="listitem" aria-label={s.name} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.04 }}
              onDragOver={(e) => { if (drag === null) return; e.preventDefault(); if (over?.stageId !== s.id) setOver({ stageId: s.id, beforeId: null }); }}
              onDrop={(e) => { e.preventDefault(); drop(s); }}
              className={cn("flex max-h-[calc(100vh-230px)] w-[272px] shrink-0 flex-col rounded-[20px] border border-white/70 bg-white/55 backdrop-blur-xl transition dark:border-white/10 dark:bg-white/[0.035]", over?.stageId === s.id && "ring-2 ring-primary/40")}>
              <header className="border-b border-black/[0.05] px-3.5 pb-2.5 pt-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
                  <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.isWon && <Trophy className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-[#047857]" />}{s.isLost && <XCircle className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-[#dc2626]" />}{s.name}</h3>
                  <span className="rounded-full bg-black/[0.05] px-1.5 text-[11px] font-semibold tabular-nums dark:bg-white/[0.08]">{list.length}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground"><b className="text-foreground tabular-nums">{fmtMoney(total, cur, true)}</b>{!s.isWon && !s.isLost && <> · weighted {fmtMoney((total * s.probability) / 100, cur, true)} · {s.probability}%</>}</p>
              </header>
              <ul className="min-h-[80px] flex-1 space-y-2 overflow-y-auto p-2">
                {list.map((d) => (
                  <li key={d.id}
                    draggable={can}
                    onDragStart={(e) => { setDrag(d.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(d.id)); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onDragOver={(e) => { if (drag === null || drag === d.id) return; e.preventDefault(); e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; const idx = list.findIndex((x) => x.id === d.id); const before = after ? list[idx + 1]?.id ?? null : d.id; if (over?.stageId !== s.id || over.beforeId !== before) setOver({ stageId: s.id, beforeId: before }); }}
                    className={cn("relative", drag === d.id && "opacity-40")}>
                    {over?.stageId === s.id && over.beforeId === d.id && drag !== d.id && <span className="absolute -top-1.5 left-1 right-1 h-0.5 rounded-full bg-primary" />}
                    <Link href={`/crm/${uid}/deals/${d.id}`} draggable={false} className={cn("block rounded-2xl border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgb(11_42_31/0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(11,42,31,0.5)]", can && "cursor-grab active:cursor-grabbing")}>
                      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{d.name}</p>
                      {d.company && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{d.company.name}</p>}
                      <div className="mt-2.5 flex items-center gap-2">
                        <b className="text-[13px] tabular-nums">{fmtMoney(d.amount, cur, true)}</b>
                        {d.closeDate && <span className={cn("flex items-center gap-1 text-[11.5px]", !s.isWon && !s.isLost && isPast(d.closeDate) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}><CalendarDays className="h-3 w-3" />{fmtDate(d.closeDate)}</span>}
                        <span className="flex-1" />
                        {d.priority === "high" && <span className="rounded-full bg-[#dc2626]/10 px-1.5 text-[10.5px] font-semibold text-[#dc2626] dark:text-[#f87171]">High</span>}
                        {d.owner && <Avatar user={d.owner} size={22} />}
                      </div>
                    </Link>
                  </li>
                ))}
                {over?.stageId === s.id && over.beforeId === null && drag !== null && <li className="h-1 rounded-full bg-primary/60" aria-hidden />}
                {!list.length && drag === null && <li className="px-2 py-6 text-center text-[12px] text-muted-foreground">No deals</li>}
              </ul>
              {can && !s.isLost && <button type="button" onClick={() => setCreate(s.id)} className="m-2 mt-0 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/5"><Plus className="h-3.5 w-3.5" /> Add deal</button>}
            </motion.section>
          );
        })}
      </div>
      {create && <CreateRecord kind="deal" onClose={() => setCreate(null)} defaults={{ pipelineId, stageId: create }} />}
      {lost && (
        <Dialog open onOpenChange={(o) => !o && setLost(null)}>
          <DialogContent className="rounded-[24px] sm:max-w-[440px]">
            <DialogTitle>Why was it lost?</DialogTitle>
            <DialogDescription>The reason is saved on the deal and in its timeline.</DialogDescription>
            <div className="flex flex-wrap gap-1.5">{["Price", "Went with a competitor", "No budget", "Bad timing", "No response"].map((x) => <button key={x} type="button" onClick={() => setReason(x)} className={cn("rounded-full border px-2.5 py-1 text-[12px]", reason === x ? "border-primary bg-primary/10 text-primary" : "border-border")}>{x}</button>)}</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason" aria-label="Reason" className={cn(input, "h-auto py-2")} />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setLost(null)} className={btnGhost}>Cancel</button><button type="button" disabled={!reason.trim()} onClick={() => { move.mutate({ ...lost, lostReason: reason.trim() }); setLost(null); setReason(""); }} className={cn(btnPrimary, "bg-[#dc2626] dark:bg-[#ef4444]")}>Mark lost</button></div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
