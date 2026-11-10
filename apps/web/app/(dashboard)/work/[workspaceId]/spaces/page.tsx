"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Orbit, Plus, Search } from "lucide-react";
import { workApi, workKeys } from "@/services/work.api";
import { CreateSpaceDialog } from "../../_components/CreateSpaceDialog";

/** All Spaces (ClickUp): every space you can see, with a quick way to open or create one. */
export default function AllSpacesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: tree, isLoading } = useQuery({ queryKey: workKeys.tree(workspaceId), queryFn: () => workApi.tree(workspaceId), staleTime: 30_000 });
  const term = q.trim().toLowerCase();
  const spaces = (tree?.spaces ?? []).filter((s) => !term || s.name.toLowerCase().includes(term));
  const stats = (s: NonNullable<typeof tree>["spaces"][number]) => {
    const lists = [...s.lists, ...s.folders.flatMap((f) => f.lists)];
    return { lists: lists.length, folders: s.folders.length, open: lists.reduce((a, l) => a + l.openTaskCount, 0) };
  };

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <h1 className="text-[18px] font-semibold">All Spaces</h1>
        {tree?.access.canManage && (
          <button type="button" onClick={() => setCreating(true)} className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> New Space
          </button>
        )}
      </div>
      <div className="px-4 pt-4 sm:px-6">
        <label className="flex h-9 w-[300px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spaces" aria-label="Search spaces" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
      </div>
      <div className="px-4 py-4 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Orbit className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-serif text-[22px]">{term ? "No spaces match" : "No spaces yet"}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {spaces.map((s) => {
              const st = stats(s);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => router.push(`/work/${workspaceId}/space/${s.uid}`)} className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgb(11_42_31/0.04)] transition-shadow hover:shadow-[0_10px_28px_-18px_rgb(11_42_31/0.4)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px] font-bold text-white" style={{ background: s.color }}>{s.name[0]?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold group-hover:text-primary">
                        <span className="truncate">{s.name}</span>
                        {s.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private" />}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                        {st.lists} {st.lists === 1 ? "list" : "lists"} · {st.folders} {st.folders === 1 ? "folder" : "folders"} · {st.open} open
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <CreateSpaceDialog
        open={creating}
        onOpenChange={setCreating}
        workspace={workspaceId}
        onCreated={() => qc.invalidateQueries({ queryKey: workKeys.tree(workspaceId) })}
      />
    </div>
  );
}
