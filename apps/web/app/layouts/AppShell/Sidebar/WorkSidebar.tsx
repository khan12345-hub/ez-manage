"use client";

/*
 * Work sidebar — ClickUp-style tree: Spaces → Folders → Lists.
 * Shares the brand mark + product switcher with the Boards sidebar.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
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
import { workApi, workKeys, type WorkFolderNode, type WorkListNode, type WorkSpaceNode } from "@/services/work.api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

        {canEdit && (
          <div className="px-4 pb-1">
            <button
              type="button"
              onClick={() => openCreate(activeListUid || null)}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-forest text-[13px] font-semibold text-forest-foreground shadow-sm hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Work">
          <Link
            href={wsParam ? `/work/${wsParam}` : "#"}
            onClick={onMobileClose}
            className={cn(ROW, "mt-1 py-2", pathname === `/work/${wsParam}` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
          >
            <Home className="h-4 w-4 shrink-0" /> My Work
          </Link>
          <Link
            href={wsParam ? `/work/${wsParam}/inbox` : "#"}
            onClick={onMobileClose}
            className={cn(ROW, "py-2", pathname === `/work/${wsParam}/inbox` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
          >
            <Inbox className="h-4 w-4 shrink-0" /> <span className="flex-1">Inbox</span>
            {inbox.primaryUnread > 0 && (
              <span className="rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">{inbox.primaryUnread}</span>
            )}
          </Link>
          <Link
            href={wsParam ? `/work/${wsParam}/people` : "#"}
            onClick={onMobileClose}
            className={cn(ROW, "py-2", pathname === `/work/${wsParam}/people` ? "bg-accent font-semibold text-accent-foreground" : "text-foreground/80 hover:bg-accent/60")}
          >
            <Users className="h-4 w-4 shrink-0" /> People
          </Link>

          <div className="mt-4 flex items-center justify-between px-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Spaces</span>
            {canManage && (
              <button type="button" aria-label="New space" title="New space" onClick={() => setDialog({ kind: "space" })} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isLoading && <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && tree && tree.spaces.length === 0 && (
            <div className="mx-1 mt-1 rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center">
              <p className="text-[13px] font-medium">No spaces yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {canManage ? "Create a space for a team or department." : "Ask a workspace admin to create a space."}
              </p>
              {canManage && (
                <button type="button" onClick={() => setDialog({ kind: "space" })} className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-forest px-2.5 py-1.5 text-xs font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" /> New space
                </button>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            {tree?.spaces.map((space) => {
              const open = !collapsed[`s${space.id}`];
              return (
                <div key={space.id}>
                  <div className={cn(ROW, "font-semibold text-foreground hover:bg-accent/60")}>
                    <button type="button" onClick={() => toggle(`s${space.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10.5px] font-bold text-white" style={{ background: space.color }}>
                        {space.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{space.name}</span>
                      {space.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Private" />}
                      {open ? <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`${space.name} options`} className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-card hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem onClick={() => setDialog({ kind: "list", space })}><ListPlus className="mr-2 h-3.5 w-3.5" />New list</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "folder", space })}><FolderPlus className="mr-2 h-3.5 w-3.5" />New folder</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDialog({ kind: "rename-space", space })}><Pencil className="mr-2 h-3.5 w-3.5" />Rename / colour</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => archive("space", space.id, space.name)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {open && (
                    <div className="mb-1">
                      {space.folders.map((folder) => {
                        const fOpen = !collapsed[`f${folder.id}`];
                        return (
                          <div key={folder.id}>
                            <div className={cn(ROW, "text-foreground/80 hover:bg-accent/60")} style={{ paddingLeft: 22 }}>
                              <button type="button" onClick={() => toggle(`f${folder.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={fOpen}>
                                <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{folder.name}</span>
                                {fOpen ? <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
                              </button>
                              {canManage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button type="button" aria-label={`${folder.name} options`} className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-card hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-40">
                                    <DropdownMenuItem onClick={() => setDialog({ kind: "list", space, folder })}><ListPlus className="mr-2 h-3.5 w-3.5" />New list</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDialog({ kind: "rename-folder", folder })}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => archive("folder", folder.id, folder.name)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            {fOpen && folder.lists.map((l) => <ListRow key={l.id} list={l} depth={2} />)}
                            {fOpen && folder.lists.length === 0 && <p className="py-1 pl-[50px] text-xs text-muted-foreground/70">No lists</p>}
                          </div>
                        );
                      })}
                      {space.lists.map((l) => <ListRow key={l.id} list={l} depth={1} />)}
                      {space.folders.length === 0 && space.lists.length === 0 && (
                        <p className="py-1 pl-9 text-xs text-muted-foreground/70">{canManage ? "Use ⋯ to add a list" : "No lists yet"}</p>
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
      {dialogProps && (
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
