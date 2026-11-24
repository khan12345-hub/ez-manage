"use client";

import { useEffect, useState } from "react";
import { Kanban, Rows3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmWs } from "../../_lib/crm";
import { DealBoard } from "../../_components/DealBoard";
import { RecordTable } from "../../_components/RecordTable";

export default function CrmDealsPage() {
  const { uid, ws } = useCrmWs();
  const [mode, setMode] = useState<"board" | "table">("board");
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [owner, setOwner] = useState("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { try { const m = localStorage.getItem(`ezcrm:${uid}:deals:mode`); if (m === "table" || m === "board") setMode(m); } catch {} }, [uid]);
  const pick = (m: "board" | "table") => { setMode(m); try { localStorage.setItem(`ezcrm:${uid}:deals:mode`, m); } catch {} };
  const pid = pipelineId ?? ws?.pipelines[0]?.id ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Layout" className="flex rounded-xl border border-border bg-card p-0.5">
          {([["board", "Board", Kanban], ["table", "Table", Rows3]] as const).map(([k, l, I]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => pick(k)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium", mode === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><I className="h-3.5 w-3.5" />{l}</button>)}
        </div>
        {mode === "board" && <>
          {(ws?.pipelines.length ?? 0) > 1 && <select aria-label="Pipeline" value={pid ?? ""} onChange={(e) => setPipelineId(Number(e.target.value))} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]">{ws!.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          <label className="flex h-9 min-w-[180px] items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals" aria-label="Search deals" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />{q && <button type="button" aria-label="Clear search" onClick={() => setQ("")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</label>
          <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]"><option value="">Everyone&apos;s deals</option><option value="me">My deals</option><option value="none">No owner</option>{(ws?.members ?? []).map((m) => <option key={m.user.id} value={m.user.id}>{`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()}</option>)}</select>
        </>}
      </div>
      {mode === "board" ? (pid ? <DealBoard pipelineId={pid} owner={owner} q={dq} /> : null) : <RecordTable object="deal" />}
    </div>
  );
}
