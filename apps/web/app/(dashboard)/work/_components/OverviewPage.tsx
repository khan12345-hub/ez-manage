"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bookmark as BookmarkIcon, ExternalLink, FileText, Folder, FolderPlus, LayoutGrid, List as ListIcon, ListPlus, Lock, Paperclip, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkOverviewList } from "@/services/work.api";
import { NameDialog } from "./NameDialog";
import { Donut, colorAt } from "./Charts";
import { LocationDashboard, Panel } from "./Dashboard";
import { TaskDrawer } from "./TaskDrawer";
import { SpaceIcon } from "./SpaceIcon";
import { loadBookmarks, recentPlaces, saveBookmarks, trackPlace, type Bookmark, type RecentPlace } from "./recent";

type Tab = "overview" | "dashboard";

/** Space / Folder page (ClickUp): Overview cards and a Dashboard tab. */
export function OverviewPage({ kind, uid, workspaceId }: { kind: "space" | "folder"; uid: string; workspaceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const key = ["work", "overview", kind, uid];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => (kind === "space" ? workApi.spaceOverview(uid) : workApi.folderOverview(uid)),
  });
  const tab: Tab = sp.get("tab") === "dashboard" ? "dashboard" : "overview";
  const taskUid = sp.get("task");
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const [dialog, setDialog] = useState<null | "list" | "folder">(null);

  useEffect(() => {
    if (kind === "folder" && data?.folder) trackPlace({ kind: "folder", uid: data.folder.uid, name: data.folder.name, parent: data.space.name, spaceUid: data.space.uid, folderUid: data.folder.uid });
  }, [kind, data?.folder?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isError) return <div className="p-10 text-center text-sm text-muted-foreground">This {kind} doesn&apos;t exist, was archived, or you don&apos;t have access.</div>;
  if (isLoading || !data) return <div className="space-y-3 p-8">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>;

  const title = kind === "space" ? data.space.name : data.folder!.name;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: workKeys.tree(workspaceId) });
  };

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="relative border-b border-border bg-card px-4 pt-4 sm:px-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${data.space.color} 0%, var(--brass) 60%, transparent 100%)` }} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
            {kind === "folder" && (
              <>
                <Link href={`/work/${workspaceId}/space/${data.space.uid}`} className="flex items-center gap-1.5 font-normal text-muted-foreground hover:text-foreground">
                  <SpaceIcon name={data.space.name} color={data.space.color} icon={data.space.icon} />
                  {data.space.name}
                </Link>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            {kind === "space" ? <SpaceIcon name={title} color={data.space.color} icon={data.space.icon} /> : <Folder className="h-4 w-4 text-muted-foreground" />}
            <span className="truncate">{title}</span>
            {data.space.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private" />}
            {kind === "space" && data.space.description && <span className="hidden truncate text-[12.5px] font-normal text-muted-foreground md:inline">· {data.space.description}</span>}
          </h1>
          <span className="flex-1" />
          {data.access.canManage && (
            <div className="flex gap-2">
              {kind === "space" && (
                <button type="button" onClick={() => setDialog("folder")} className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                  <FolderPlus className="h-3.5 w-3.5" /> New folder
                </button>
              )}
              <button type="button" onClick={() => setDialog("list")} className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
                <ListPlus className="h-3.5 w-3.5" /> New list
              </button>
            </div>
          )}
        </div>
        <nav role="tablist" aria-label="Views" className="mt-3 flex gap-1">
          {([["overview", "Overview", LayoutGrid], ["dashboard", "Dashboard", BarChart3]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setParam("tab", id === "overview" ? null : id)} className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] font-medium", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-muted/20 px-4 py-4 sm:px-6">
        {tab === "dashboard" ? (
          <LocationDashboard kind={kind} uid={uid} onOpenTask={(t) => setParam("task", t)} />
        ) : (
          <OverviewCards kind={kind} uid={uid} data={data} workspaceId={workspaceId} onNewList={data.access.canManage ? () => setDialog("list") : undefined} onOpenTask={(t) => setParam("task", t)} />
        )}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setParam("task", null)} onOpenTask={(t) => setParam("task", t)} />
      <NameDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === "folder" ? "New folder" : "New list"}
        description={`In ${data.space.name}${data.folder ? ` / ${data.folder.name}` : ""}`}
        placeholder={dialog === "folder" ? "e.g. Campaigns" : "e.g. Q4 Launch"}
        onSubmit={async (r) => {
          if (dialog === "folder") {
            await workApi.createFolder(data.space.id, r.name);
            refresh();
          } else {
            const list = await workApi.createList(data.space.id, { name: r.name, folderId: data.folder?.id });
            refresh();
            router.push(`/work/${workspaceId}/list/${list.uid}`);
          }
        }}
      />
    </div>
  );
}

function OverviewCards({
  kind,
  uid,
  data,
  workspaceId,
  onNewList,
  onOpenTask,
}: {
  kind: "space" | "folder";
  uid: string;
  data: NonNullable<Awaited<ReturnType<typeof workApi.spaceOverview>>>;
  workspaceId: string;
  onNewList?: () => void;
  onOpenTask: (uid: string) => void;
}) {
  const router = useRouter();
  const { data: stats } = useQuery({ queryKey: ["work", "stats", kind, uid], queryFn: () => workApi.stats(kind, uid) });
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const loc = `${kind}:${uid}`;
  const [marks, setMarks] = useState<Bookmark[]>([]);
  const [adding, setAdding] = useState(false);
  const [bmUrl, setBmUrl] = useState("");
  useEffect(() => {
    setRecent(recentPlaces().filter((r) => (kind === "space" ? r.spaceUid === data.space.uid : r.folderUid === data.folder?.uid && r.kind === "list")).slice(0, 6));
    setMarks(loadBookmarks(loc));
  }, [kind, loc, data.space.uid, data.folder?.uid]);
  const addMark = () => {
    let url = bmUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) url = `https://${url}`;
    let title = url;
    try { title = url.startsWith("/") ? url : new URL(url).hostname.replace(/^www\./, ""); } catch {}
    const next = [...marks, { id: `${Date.now()}`, title, url }];
    setMarks(next);
    saveBookmarks(loc, next);
    setBmUrl("");
    setAdding(false);
  };
  const dropMark = (id: string) => {
    const next = marks.filter((m) => m.id !== id);
    setMarks(next);
    saveBookmarks(loc, next);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Panel title="Recent" span={2}>
        {recent.length ? (
          <ul className="space-y-1">
            {recent.map((r) => (
              <li key={`${r.kind}${r.uid}`}>
                <Link href={`/work/${workspaceId}/${r.kind}/${r.uid}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-accent">
                  {r.kind === "folder" ? <Folder className="h-3.5 w-3.5 text-muted-foreground" /> : <ListIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="truncate">{r.name}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">· in {r.parent}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">Lists you open here show up in Recent.</p>
        )}
      </Panel>

      <Panel title="Docs" span={2}>
        <div className="flex flex-col items-center py-4 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-[12.5px] text-muted-foreground">There are no Docs in this location yet.</p>
          <span className="mt-2 rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Docs · Soon</span>
        </div>
      </Panel>

      <Panel
        title="Bookmarks"
        span={2}
        action={marks.length > 0 && <button type="button" aria-label="Add bookmark" onClick={() => setAdding(true)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>}
      >
        {marks.length > 0 && (
          <ul className="space-y-1">
            {marks.map((m) => (
              <li key={m.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                <BookmarkIcon className="h-3.5 w-3.5 shrink-0 text-[#b08d57]" />
                <a href={m.url} target={m.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:underline">{m.title}</a>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <button type="button" aria-label={`Remove ${m.title}`} onClick={() => dropMark(m.id)} className="hidden text-muted-foreground hover:text-destructive group-hover:block"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {adding ? (
          <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); addMark(); }}>
            <input autoFocus value={bmUrl} onChange={(e) => setBmUrl(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} placeholder="Paste any link" aria-label="Bookmark URL" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] outline-none focus:border-primary/50" />
            <button type="submit" className="h-8 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Add</button>
          </form>
        ) : (
          !marks.length && (
            <div className="flex flex-col items-center py-3 text-center">
              <BookmarkIcon className="h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 max-w-[240px] text-[12.5px] text-muted-foreground">Bookmarks make it easy to save items or any URL from around the web.</p>
              <button type="button" onClick={() => setAdding(true)} className="mt-2 rounded-md bg-forest px-3 py-1.5 text-[12px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Add Bookmark</button>
            </div>
          )
        )}
      </Panel>

      {kind === "space" && (
        <Panel title="Folders" span={6}>
          {data.folders.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.folders.map((f) => (
                <li key={f.id}>
                  <Link href={`/work/${workspaceId}/folder/${f.uid}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[13.5px] font-medium hover:bg-accent/40">
                    <Folder className="h-4 w-4 text-muted-foreground" /> <span className="truncate">{f.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{data.lists.filter((l) => l.folder?.id === f.id).length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">No folders in this space.</p>
          )}
        </Panel>
      )}

      <Panel title="Lists" span={6}>
        <ListsTable lists={kind === "space" ? data.lists.filter((l) => !l.folder) : data.lists} fallbackColor={data.space.color} onOpen={(l) => router.push(`/work/${workspaceId}/list/${l.uid}`)} />
        {onNewList && (
          <button type="button" onClick={onNewList} className="mt-1 flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> New List
          </button>
        )}
      </Panel>

      <Panel title="Resources" span={3}>
        {stats?.files.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.files.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => onOpenTask(f.task.uid)} title={`${f.file.fileName} · ${f.task.name}`} className="group block w-full overflow-hidden rounded-lg border border-border text-left hover:shadow-sm">
                  {f.file.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.file.url} alt={f.file.fileName} className="h-20 w-full object-cover" />
                  ) : (
                    <span className="flex h-20 items-center justify-center bg-muted"><Paperclip className="h-5 w-5 text-muted-foreground" /></span>
                  )}
                  <span className="block truncate px-2 py-1 text-[11.5px]">{f.file.fileName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-[12.5px] text-muted-foreground">Files attached to tasks here show up in Resources.</p>
        )}
      </Panel>

      {kind === "space" ? (
        <Panel title="Workload by Status" span={3}>
          {stats ? <Donut data={stats.byStatus.map((s) => ({ label: s.name, value: s.count, color: s.color }))} label="Workload by status" /> : <div className="h-40 animate-pulse rounded-lg bg-muted" />}
        </Panel>
      ) : (
        <Panel title="Tasks by Assignee" span={3}>
          {stats ? <Donut data={stats.byAssignee.map((a, i) => ({ label: userName(a.user), value: a.total, color: colorAt(i) }))} label="Tasks by assignee" /> : <div className="h-40 animate-pulse rounded-lg bg-muted" />}
        </Panel>
      )}
    </div>
  );
}

function ListsTable({ lists, fallbackColor, onOpen }: { lists: WorkOverviewList[]; fallbackColor: string; onOpen: (l: WorkOverviewList) => void }) {
  if (!lists.length) return <p className="text-[12.5px] text-muted-foreground">No lists yet.</p>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
          <th className="py-1.5 pl-2 font-medium">Name</th>
          <th className="w-16 py-1.5 font-medium">Color</th>
          <th className="w-[34%] py-1.5 font-medium">Progress</th>
          <th className="w-20 py-1.5 font-medium">Open</th>
          <th className="w-20 py-1.5 font-medium">Overdue</th>
        </tr>
      </thead>
      <tbody>
        {lists.map((l) => (
          <tr key={l.id} onClick={() => onOpen(l)} className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-accent/30">
            <td className="py-2 pl-2">
              <span className="flex items-center gap-2"><ListIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate font-medium">{l.name}</span></span>
            </td>
            <td><span className="block h-3 w-3 rounded-full" style={{ background: l.color ?? fallbackColor }} /></td>
            <td>
              <span className="flex items-center gap-2 pr-4">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/80" style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} /></span>
                <span className="w-14 font-mono text-[11.5px] text-muted-foreground">{l.done}/{l.total}</span>
              </span>
            </td>
            <td className="text-muted-foreground">{l.open}</td>
            <td className={cn(l.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{l.overdue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
