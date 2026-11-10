"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { workApi } from "@/services/work.api";
import { SPACE_COLORS } from "../../_components/SpaceIcon";

/** Work workspace settings: name, colour, delete (owner). Boards is not affected by any of this. */
export default function WorkWorkspaceSettings() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces });
  const me = list.find((w) => w.uid === ws);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[6]!);
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (me) {
      setName(me.name);
      if (me.color) setColor(me.color);
    }
  }, [me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";
  const save = useMutation({
    mutationFn: () => workApi.updateWorkspace(ws, { name: name.trim(), color }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "my-workspaces"] }); toast.success("Workspace saved"); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't save."),
  });
  const remove = useMutation({
    mutationFn: () => workApi.deleteWorkspace(ws, confirm),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["work", "my-workspaces"] }); toast.success("Workspace deleted"); router.replace("/work"); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete."),
  });
  if (!me) return <div className="p-8"><div className="h-32 animate-pulse rounded-xl bg-muted" /></div>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-[22px] font-semibold">Workspace settings</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">This Work workspace is separate from Boards — changes here never touch Boards.</p>

      <section aria-label="General" className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[14px] font-semibold">General</h2>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl text-[20px] font-bold text-white" style={{ background: color }}>{(name || "W")[0]!.toUpperCase()}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={80} aria-label="Workspace name" className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50 disabled:opacity-60" />
        </div>
        <div role="radiogroup" aria-label="Workspace colour" className="mt-3 flex flex-wrap gap-2">
          {SPACE_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} disabled={!canManage} onClick={() => setColor(c)} className="flex h-6 w-6 items-center justify-center rounded-full disabled:opacity-60" style={{ background: c }}>
              {color === c && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          ))}
        </div>
        {canManage && (
          <button type="button" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()} className="mt-4 h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Save</button>
        )}
      </section>

      {me.role === "OWNER" && (
        <section aria-label="Delete workspace" className="mt-6 rounded-xl border border-destructive/40 bg-card p-5">
          <h2 className="text-[14px] font-semibold text-destructive">Delete this workspace</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Removes its spaces, lists and tasks from Work for everyone. Type <strong>{me.name}</strong> to confirm.</p>
          <div className="mt-3 flex gap-2">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm workspace name" className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none" />
            <button type="button" disabled={confirm.trim() !== me.name.trim() || remove.isPending} onClick={() => remove.mutate()} className="flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-[13px] font-semibold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </section>
      )}
    </div>
  );
}
