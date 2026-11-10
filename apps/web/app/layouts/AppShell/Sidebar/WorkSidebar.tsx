"use client";

/*
 * Work sidebar — ClickUp-style tree: Spaces → Folders → Lists.
 * Shares the brand mark + product switcher with the Boards sidebar.
 */

import { CreateSpaceDialog } from "@/app/(dashboard)/work/_components/CreateSpaceDialog";
import { SpaceIcon } from "@/app/(dashboard)/work/_components/SpaceIcon";
import { ProfilePanel } from "@/app/(dashboard)/work/_components/ProfilePanel";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Asterisk,
  AtSign,
  ListChecks,
  Megaphone,
  Pin,
  Send,
  CheckCheck,
  MessageSquareReply,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronsDownUp,
  FileText,
  FolderOpen,
  Hash,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Orbit,
  UsersRound,
  PenTool,
  Search,
  SquareCheckBig,
  UserCheck,
  Video,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  Home,
  Inbox,
  ListPlus,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Users,
  UserPlus,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { dayOf, workApi, workKeys, type WorkFolderNode, type WorkListNode, type WorkSpaceNode } from "@/services/work.api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NameDialog, type NameDialogResult } from "@/app/(dashboard)/work/_components/NameDialog";
import { BrandMark, ProductSwitcher } from "./ProductNav";
import { CreatePanel } from "@/app/(dashboard)/work/_components/CreatePanel";
import { useWorkCreate } from "@/store/work-create";
import { useInboxCounts } from "@/app/(dashboard)/work/[workspaceId]/inbox/useInboxCounts";
import { WorkInviteModal, useWorkInvite } from "@/app/(dashboard)/work/_components/WorkInviteModal";

type DialogState =
  | null
  | { kind: "space" }
  | { kind: "folder"; space: WorkSpaceNode }
  | { kind: "list"; space: WorkSpaceNode; folder?: WorkFolderNode }
  | { kind: "rename-space"; space: WorkSpaceNode }
  | { kind: "rename-folder"; folder: WorkFolderNode }
  | { kind: "rename-list"; list: WorkListNode };

const SOON_CREATE = [
  { label: "Message", icon: MessageSquare, color: "#6366F1" },
  { label: "Channel", icon: Hash, color: "#475569" },
  { label: "Doc", icon: FileText, color: "#2563EB" },
  { label: "Form", icon: SquareCheckBig, color: "#7C3AED" },
  { label: "Dashboard", icon: LayoutDashboard, color: "#9333EA" },
  { label: "Whiteboard", icon: PenTool, color: "#D97706" },
  { label: "Clip", icon: Video, color: "#DB2777" },
];

const MORE_SOON = [
  { label: "Chat Activity", icon: AtSign },
  { label: "Drafts & Sent", icon: Send },
  { label: "All Channels", icon: LayoutGrid },
];
const MORE_PAGES = [
  { id: "spaces", label: "All Spaces", path: "spaces", icon: Orbit },
  { id: "all-tasks", label: "All Tasks", path: "all-tasks", icon: ListChecks },
  { id: "teams", label: "Teams", path: "teams", icon: UsersRound },
];

const ROW = "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] transition-colors";

export function WorkSidebar({
  isOpen,
  onToggle,
  isMobileOpen = false,
  onMobileClose,
}: {
  isOpen: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ workspaceId?: string; listUid?: string }>();
  const qc = useQueryClient();
  const wsParam = String(params.workspaceId ?? "");
  const activeListUid = String(params.listUid ?? "");

  const { data: workspaces = [] } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  const currentWs: any = (workspaces as any[]).find((w) => w.uid === wsParam || String(w.id) === wsParam);
  const { data: tree, isLoading } = useQuery({
    queryKey: workKeys.tree(wsParam),
    queryFn: () => workApi.tree(wsParam),
    enabled: !!wsParam,
    staleTime: 30_000,
  });
  const canManage = !!tree?.access.canManage;
  const canEdit = !!tree?.access.canEdit;
  const inbox = useInboxCounts();
  const openCreate = useWorkCreate((st) => st.openCreate);
  const openWorkInvite = useWorkInvite((st) => st.setOpen);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [myOpen, setMyOpen] = useState(true);
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    try { setPins(JSON.parse(localStorage.getItem("ez:work:sidebarPins") ?? "[]")); } catch {}
  }, []);
  const togglePin = (id: string) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    setPins(next);
    try { localStorage.setItem("ez:work:sidebarPins", JSON.stringify(next)); } catch {}
  };
  const wsName = (workspaces as any[]).find((w) => w.uid === wsParam)?.name ?? "";
  const searchParams = useSearchParams();
  const myView = searchParams.get("view");
  const { data: myTasks = [] } = useQuery({ queryKey: workKeys.my(wsParam), queryFn: () => workApi.myTasks(wsParam), enabled: !!wsParam, staleTime: 30_000 });
  const myCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = myTasks.filter((t) => !t.completedAt && !t.parentId);
    const overdue = open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() < today.getTime()).length;
    const dueToday = open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() === today.getTime()).length;
    return { open: open.length, overdue, todayOverdue: overdue + dueToday };
  }, [myTasks]);
  // sidebar search: keep spaces/folders that match or contain a matching list
  const visibleSpaces = useMemo(() => {
    const q = term.trim().toLowerCase();
    const hit = (n: string) => !q || n.toLowerCase().includes(q);
    return (tree?.spaces ?? [])
      .map((space) => {
        const spaceHit = hit(space.name);
        const folders = space.folders
          .map((folder) => ({ folder, lists: spaceHit || hit(folder.name) ? folder.lists : folder.lists.filter((l) => hit(l.name)) }))
          .filter((f) => spaceHit || hit(f.folder.name) || f.lists.length);
        const lists = spaceHit ? space.lists : space.lists.filter((l) => hit(l.name));
        return { space, folders, lists, show: spaceHit || folders.length > 0 || lists.length > 0 };
      })
      .filter((x) => x.show);
  }, [tree, term]);
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const [dialog, setDialog] = useState<DialogState>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: workKeys.tree(wsParam) });

  const go = (href: string) => {
    onMobileClose?.();
    router.push(href);
  };

  const onDialogSubmit = async (r: NameDialogResult) => {
    if (!dialog) return;
    if (dialog.kind === "space") {
      await workApi.createSpace(wsParam, { name: r.name, color: r.color, isPrivate: r.isPrivate });
    } else if (dialog.kind === "folder") {
      await workApi.createFolder(dialog.space.id, r.name);
    } else if (dialog.kind === "list") {
      const list = await workApi.createList(dialog.space.id, { name: r.name, folderId: dialog.folder?.id });
      await refresh();
      go(`/work/${wsParam}/list/${list.uid}`);
      return;
    } else if (dialog.kind === "rename-space") {
      await workApi.updateSpace(dialog.space.id, { name: r.name, ...(r.color ? { color: r.color } : {}) });
    } else if (dialog.kind === "rename-folder") {
      await workApi.updateFolder(dialog.folder.id, { name: r.name });
    } else if (dialog.kind === "rename-list") {
      await workApi.updateList(dialog.list.id, { name: r.name });
    }
    await refresh();
  };

  const archive = async (kind: "space" | "folder" | "list", id: number, name: string) => {
    if (!window.confirm(`Archive "${name}"? It will be hidden for everyone.`)) return;
    if (kind === "space") await workApi.archiveSpace(id);
    if (kind === "folder") await workApi.archiveFolder(id);
    if (kind === "list") await workApi.archiveList(id);
    await refresh();
  };

  const dialogProps = useMemo(() => {
    if (!dialog) return null;
    switch (dialog.kind) {
      case "space":
        return { title: "New space", description: "A space holds a team's folders, lists and statuses.", placeholder: "e.g. Marketing", withColor: true, withPrivacy: true };
      case "folder":
        return { title: "New folder", description: `In ${dialog.space.name}`, placeholder: "e.g. Campaigns" };
      case "list":
        return { title: "New list", description: dialog.folder ? `In ${dialog.space.name} / ${dialog.folder.name}` : `In ${dialog.space.name}`, placeholder: "e.g. Q4 Launch" };
      case "rename-space":
        return { title: "Rename space", initial: { name: dialog.space.name, color: dialog.space.color }, withColor: true, submitLabel: "Save" };
      case "rename-folder":
        return { title: "Rename folder", initial: { name: dialog.folder.name }, submitLabel: "Save" };
      case "rename-list":
        return { title: "Rename list", initial: { name: dialog.list.name }, submitLabel: "Save" };
    }
  }, [dialog]);

  const ListRow = ({ list, depth }: { list: WorkListNode; depth: number }) => {
    const active = list.uid === activeListUid;
    return (
      <div className={cn(ROW, active ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")} style={{ paddingLeft: 8 + depth * 14 }}>
        <button type="button" onClick={() => go(`/work/${wsParam}/list/${list.uid}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: list.color ?? "var(--muted-foreground)" }} />
          <span className="truncate">{list.name}</span>
        </button>
        {list.openTaskCount > 0 && <span className="font-mono text-[11px] text-muted-foreground group-hover:hidden">{list.openTaskCount}</span>}
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`${list.name} options`} className="hidden rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground group-hover:block data-[state=open]:block">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => setDialog({ kind: "rename-list", list })}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => archive("list", list.id, list.name)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "select-none flex-col border-r border-border bg-background",
        "fixed inset-y-0 left-0 z-50 flex h-full shadow-xl transition-transform duration-300 ease-in-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:z-auto md:flex md:h-full md:translate-x-0 md:shadow-none md:transition-none",
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden bg-background ez-sidebar-surface",
          "w-[270px] md:transition-[width] md:duration-300 md:ease-in-out",
          isOpen ? "md:w-[270px]" : "md:w-0",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/home" className="flex min-w-0 items-center gap-2.5" aria-label="EZ Manage — Home">
            <BrandMark />
            <span className="truncate font-heading text-base font-semibold tracking-tight text-foreground">EZ Manage</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={onToggle} className="hidden rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex" aria-label="Collapse sidebar">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={onMobileClose} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ProductSwitcher
          active="work"
          workHref={wsParam ? `/work/${wsParam}` : undefined}
          showCeo={user?.systemRole === "SUPER_ADMIN"}
          onNavigate={onMobileClose}
        />

        {/* Home row: search + Create menu (always visible, like ClickUp) */}
        <div className="flex items-center gap-1 px-4 pb-1 pt-3">
          <span className="flex-1 text-[15px] font-semibold">Home</span>
          <button type="button" aria-label="Search the sidebar" title="Search" aria-pressed={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setTerm(""); }} className={cn("rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground", searchOpen && "bg-accent text-foreground")}>
            <Search className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Create" title="Create" className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-card px-1.5 text-foreground shadow-sm hover:bg-accent">
                <Plus className="h-4 w-4" /><ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Create</DropdownMenuLabel>
              {canEdit && <DropdownMenuItem onClick={() => openCreate(activeListUid || null)}><CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />Task</DropdownMenuItem>}
              {canManage && (tree?.spaces.length ?? 0) > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><ListPlus className="mr-2 h-4 w-4 text-muted-foreground" /><span><span className="block">List</span><span className="block text-[11px] text-muted-foreground">Track tasks, projects &amp; more</span></span></DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">In which space?</DropdownMenuLabel>
                      {tree!.spaces.map((sp) => <DropdownMenuItem key={sp.id} onClick={() => setDialog({ kind: "list", space: sp })}>{sp.name}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><FolderPlus className="mr-2 h-4 w-4 text-muted-foreground" /><span><span className="block">Folder</span><span className="block text-[11px] text-muted-foreground">Group lists inside a space</span></span></DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">In which space?</DropdownMenuLabel>
                      {tree!.spaces.map((sp) => <DropdownMenuItem key={sp.id} onClick={() => setDialog({ kind: "folder", space: sp })}>{sp.name}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {canManage && (
                <DropdownMenuItem onClick={() => setDialog({ kind: "space" })}><Orbit className="mr-2 h-4 w-4 text-muted-foreground" /><span><span className="block">Space</span><span className="block text-[11px] text-muted-foreground">Organize work by team or department</span></span></DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {SOON_CREATE.map((x) => (
                <DropdownMenuItem key={x.label} disabled>
                  <x.icon className="mr-2 h-4 w-4" style={{ color: x.color }} />{x.label}
                  <span className="ml-auto rounded bg-muted px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {searchOpen && (
          <div className="px-4 pb-1">
            <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (setSearchOpen(false), setTerm(""))} placeholder="Search spaces, folders, lists" aria-label="Search spaces, folders and lists" className="w-full bg-transparent text-[13px] outline-none" />
            </label>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Work">
          {!term && (
            <>
              <Link
                href={wsParam ? `/work/${wsParam}/inbox` : "#"}
                onClick={onMobileClose}
                className={cn(ROW, "py-[7px]", pathname === `/work/${wsParam}/inbox` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
              >
                <Inbox className="h-4 w-4 shrink-0" /> <span className="flex-1">Inbox</span>
                {inbox.primaryUnread > 0 && <span className="rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{inbox.primaryUnread}</span>}
              </Link>

              <Link
                href={wsParam ? `/work/${wsParam}/replies` : "#"}
                onClick={onMobileClose}
                className={cn(ROW, "py-[7px]", pathname === `/work/${wsParam}/replies` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
              >
                <MessageSquareReply className="h-4 w-4 shrink-0" /> Replies
              </Link>
              <Link
                href={wsParam ? `/work/${wsParam}/assigned-comments` : "#"}
                onClick={onMobileClose}
                className={cn(ROW, "py-[7px]", pathname === `/work/${wsParam}/assigned-comments` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
              >
                <CheckCheck className="h-4 w-4 shrink-0" /> Assigned Comments
              </Link>

              <span title="Coming soon" className={cn(ROW, "cursor-not-allowed py-[7px] text-foreground/45")}>
                <Megaphone className="h-4 w-4 shrink-0" /> <span className="flex-1">Posts</span>
                <span className="rounded bg-muted px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
              </span>

              {/* My Tasks */}
              <div className={cn(ROW, "py-[7px] text-foreground/80 hover:bg-accent/60")}>
                <button type="button" aria-label={myOpen ? "Collapse My Tasks" : "Expand My Tasks"} aria-expanded={myOpen} onClick={() => setMyOpen(!myOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span className="flex-1">My Tasks</span>
                  {myOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              {myOpen && (
                <>
                  <Link
                    href={wsParam ? `/work/${wsParam}` : "#"}
                    onClick={onMobileClose}
                    className={cn(ROW, "py-[6px] pl-7", pathname === `/work/${wsParam}` && myView !== "today" ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/75 hover:bg-accent/60")}
                  >
                    <Home className="h-3.5 w-3.5 shrink-0" /> <span className="flex-1">Assigned to me</span>
                    {myCounts.open > 0 && <span className="font-mono text-[11px] text-muted-foreground">{myCounts.open}</span>}
                  </Link>
                  <Link
                    href={wsParam ? `/work/${wsParam}?view=today` : "#"}
                    onClick={onMobileClose}
                    className={cn(ROW, "py-[6px] pl-7", pathname === `/work/${wsParam}` && myView === "today" ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/75 hover:bg-accent/60")}
                  >
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" /> <span className="flex-1">Today &amp; Overdue</span>
                    {myCounts.todayOverdue > 0 && <span className={cn("font-mono text-[11px]", myCounts.overdue ? "text-destructive" : "text-muted-foreground")}>{myCounts.todayOverdue}</span>}
                  </Link>
                </>
              )}

              {/* pinned or currently open "More" pages show here, like ClickUp */}
              {MORE_PAGES.filter((m) => pins.includes(m.id) || pathname === `/work/${wsParam}/${m.path}`).map((m) => (
                <Link
                  key={m.id}
                  href={`/work/${wsParam}/${m.path}`}
                  onClick={onMobileClose}
                  className={cn(ROW, "py-[7px]", pathname === `/work/${wsParam}/${m.path}` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
                >
                  <m.icon className="h-4 w-4 shrink-0" /> {m.label}
                </Link>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={cn(ROW, "py-[7px] text-foreground/80 hover:bg-accent/60")}>
                    <MoreHorizontal className="h-4 w-4 shrink-0" /> More
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-60">
                  {MORE_SOON.map((m) => (
                    <DropdownMenuItem key={m.label} disabled>
                      <m.icon className="mr-2 h-4 w-4" />{m.label}
                      <span className="ml-auto rounded bg-muted px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
                    </DropdownMenuItem>
                  ))}
                  {MORE_PAGES.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => go(`/work/${wsParam}/${m.path}`)} className="group/more">
                      <m.icon className="mr-2 h-4 w-4 text-muted-foreground" />{m.label}
                      <button
                        type="button"
                        aria-label={pins.includes(m.id) ? `Unpin ${m.label}` : `Pin ${m.label}`}
                        title={pins.includes(m.id) ? "Unpin from sidebar" : "Pin to sidebar"}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); togglePin(m.id); }}
                        className={cn("ml-auto rounded p-0.5 hover:bg-muted", pins.includes(m.id) ? "text-primary" : "text-muted-foreground opacity-0 group-hover/more:opacity-100")}
                      >
                        <Pin className={cn("h-3.5 w-3.5", pins.includes(m.id) && "fill-current")} />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border/70 px-2 pb-1 pt-3">
            <span className="text-[12px] font-semibold text-muted-foreground">Spaces</span>
            {canManage && (
              <button type="button" aria-label="New space" title="New space" onClick={() => setDialog({ kind: "space" })} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {!term && (tree?.spaces.length ?? 0) > 0 && (
            <Link
              href={`/work/${wsParam}/all-tasks`}
              onClick={onMobileClose}
              className={cn(ROW, "py-[7px]", pathname === `/work/${wsParam}/all-tasks` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
            >
              <Asterisk className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">All Tasks</span>
              <span className="truncate text-[11.5px] text-muted-foreground">· {wsName}</span>
            </Link>
          )}
          {isLoading && <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && tree && tree.spaces.length === 0 && (
            <div className="mx-1 mt-1 rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center">
              <p className="text-[13px] font-medium">No spaces yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{canManage ? "Create a space for a team or department." : "Ask a Work admin to create a space."}</p>
              {canManage && (
                <button type="button" onClick={() => setDialog({ kind: "space" })} className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-forest px-2.5 py-1.5 text-xs font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" /> New space
                </button>
              )}
            </div>
          )}
          {term && visibleSpaces.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nothing matches “{term}”.</p>}

          <div className="space-y-0.5">
            {visibleSpaces.map(({ space, folders, lists }) => {
              const open = !!term || !collapsed[`s${space.id}`];
              const spaceActive = pathname === `/work/${wsParam}/space/${space.uid}`;
              return (
                <div key={space.id}>
                  <div className={cn(ROW, "pl-1 font-semibold", spaceActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60")}>
                    <button type="button" onClick={() => toggle(`s${space.id}`)} aria-label={open ? `Collapse ${space.name}` : `Expand ${space.name}`} aria-expanded={open} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground">
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => go(`/work/${wsParam}/space/${space.uid}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <SpaceIcon name={space.name} color={space.color} icon={space.icon} size={20} />
                      <span className="truncate">{space.name}</span>
                      {space.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Private" />}
                    </button>
                    {canManage && (
                      <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label={`${space.name} options`} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => go(`/work/${wsParam}/space/${space.uid}`)}><LayoutGrid className="mr-2 h-3.5 w-3.5" />Overview</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDialog({ kind: "rename-space", space })}><Pencil className="mr-2 h-3.5 w-3.5" />Rename / colour</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => archive("space", space.id, space.name)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label={`Add to ${space.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={() => setDialog({ kind: "list", space })}><ListPlus className="mr-2 h-3.5 w-3.5" />New list</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDialog({ kind: "folder", space })}><FolderPlus className="mr-2 h-3.5 w-3.5" />New folder</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    )}
                  </div>

                  {open && (
                    <div className="mb-1">
                      {folders.map(({ folder, lists: fLists }) => {
                        const fOpen = !!term || !collapsed[`f${folder.id}`];
                        const folderActive = pathname === `/work/${wsParam}/folder/${folder.uid}`;
                        return (
                          <div key={folder.id}>
                            <div className={cn(ROW, folderActive ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")} style={{ paddingLeft: 18 }}>
                              <button type="button" onClick={() => toggle(`f${folder.id}`)} aria-label={fOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`} aria-expanded={fOpen} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground">
                                {fOpen ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                              </button>
                              <button type="button" onClick={() => go(`/work/${wsParam}/folder/${folder.uid}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                <span className="truncate">{folder.name}</span>
                              </button>
                              {canManage && (
                                <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" aria-label={`${folder.name} options`} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40">
                                      <DropdownMenuItem onClick={() => go(`/work/${wsParam}/folder/${folder.uid}`)}><LayoutGrid className="mr-2 h-3.5 w-3.5" />Overview</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDialog({ kind: "rename-folder", folder })}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => archive("folder", folder.id, folder.name)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <button type="button" aria-label={`New list in ${folder.name}`} title="New list" onClick={() => setDialog({ kind: "list", space, folder })} className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                                </span>
                              )}
                            </div>
                            {fOpen && fLists.map((l) => <ListRow key={l.id} list={l} depth={2} />)}
                            {fOpen && fLists.length === 0 && !term && <p className="py-1 pl-[50px] text-xs text-muted-foreground/70">No lists</p>}
                          </div>
                        );
                      })}
                      {lists.map((l) => <ListRow key={l.id} list={l} depth={1} />)}
                      {!term && space.folders.length === 0 && space.lists.length === 0 && (
                        <p className="py-1 pl-9 text-xs text-muted-foreground/70">{canManage ? "Use + to add a list" : "No lists yet"}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {canManage && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => openWorkInvite(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground"
            >
              <UserPlus className="h-4 w-4" /> Invite people
            </button>
          </div>
        )}
        <WorkInviteModal />
        <div className="flex items-center gap-2.5 border-t border-border px-4 py-3.5">
          <BrandMark size={26} />
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-semibold text-foreground">EZ Manage · Work</p>
            <p className="truncate font-serif text-[13px] italic text-muted-foreground">One desk for every company.</p>
          </div>
        </div>
      </div>

      {!isOpen && (
        <button onClick={onToggle} aria-label="Open sidebar" className="absolute -right-3 top-1/2 z-50 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow hover:bg-muted hover:text-foreground md:flex">
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {wsParam && <CreatePanel ws={wsParam} />}
      {wsParam && <ProfilePanel />}
      <CreateSpaceDialog
        open={dialog?.kind === "space"}
        onOpenChange={(o) => !o && setDialog(null)}
        workspace={wsParam}
        onCreated={(s) => { refresh(); go(`/work/${wsParam}/space/${s.uid}`); }}
      />
      {dialogProps && dialog?.kind !== "space" && (
        <NameDialog
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          {...dialogProps}
          onSubmit={onDialogSubmit}
        />
      )}
    </div>
  );
}
