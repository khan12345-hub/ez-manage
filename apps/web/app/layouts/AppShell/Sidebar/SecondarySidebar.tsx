"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Building2,
  Cog,
  SquareKanban,
  HelpCircle,
  MessageSquare,
  Home,
  FileText,
  LayoutGrid,
  Ellipsis,
  Trash2,
} from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { getAllWorkspaces } from "@/services/workspace.api";
import type { Workspace } from "@repo/shared";
import { getBoards, getBoardDetail } from "@/services/boards.api";
import { getWorkspaceDocs, deleteWorkspaceDoc } from "@/services/docs.api";

import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { CreateBoardModal } from "@/components/CreateBoardModal";
import { DocCreateModal } from "@/components/DocCreateModal";
import { ManageWorkspaceDropDown } from "./ManageWorkspace";
import { ManageBoardDropdown } from "./ManageBoard";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useInviteModalStore } from "@/store/invite-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";

function ChatNavLink({ workspaceId }: { workspaceId: number }) {
  const { unreadCounts } = useChatStore();
  const total = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  return (
    <Link
      href={`/workspace/${workspaceId}/chat`}
      className="relative flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <MessageSquare strokeWidth={1.5} className="h-4 w-4" />
      Team Chat
      {total > 0 && (
        <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}

interface SecondarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SecondarySidebar({ isOpen, onToggle, isMobileOpen = false, onMobileClose }: SecondarySidebarProps) {
  const router = useRouter();
  const params = useParams();

  const workspaceIdParam = params.workspaceId;
  const boardIdParam = params.boardId;
  const docIdParam = params.docId;

  const workspaceId = Number(
    Array.isArray(workspaceIdParam) ? workspaceIdParam[0] : workspaceIdParam,
  );
  const boardId = Number(
    Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam,
  );
  const activeDocId = Number(
    Array.isArray(docIdParam) ? docIdParam[0] : docIdParam,
  );

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isContentExpanded, setIsContentExpanded] = useState(true);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateDocOpen, setIsCreateDocOpen] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const [navigatingBoardId, setNavigatingBoardId] = useState<number | null>(null);

  const {
    setBoard, setBoardRole,
    setWorkspace: setWorkspaceID,
    setWorkspaceRole,
  } = useInviteModalStore();

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    retry: false,
    staleTime: 60_000,
  });

  const { data: boards = [], isLoading: isBoardsLoading } = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => getBoards(workspaceId),
    enabled: Number.isInteger(workspaceId) && workspaceId > 0,
    staleTime: 60_000,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["workspace-docs", workspaceId],
    queryFn: () => getWorkspaceDocs(workspaceId),
    enabled: Number.isInteger(workspaceId) && workspaceId > 0,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) return;
    setWorkspaceID(workspaceId);
  }, [workspaceId, setWorkspaceID]);

  useEffect(() => {
    if (!Number.isInteger(boardId) || boardId <= 0) return;
    setBoard(boardId);
  }, [boardId, setBoard]);

  useEffect(() => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0 || !workspaces.length) return;
    const currentWorkspace = workspaces.find((item: Workspace) => item.id === workspaceId);
    if (!currentWorkspace) return;
    setWorkspace(currentWorkspace);
    setWorkspaceRole(
      (currentWorkspace as any).role ?? (currentWorkspace as any).member?.role ?? "",
    );
  }, [workspaceId, workspaces, setWorkspaceRole]);

  useEffect(() => {
    if (!Number.isInteger(boardId) || boardId <= 0 || !boards.length) return;
    const currentBoard = boards.find((board: any) => board.id === boardId);
    if (!currentBoard) return;
    setBoardRole(currentBoard.role);
  }, [boardId, boards, setBoardRole]);

  const queryClient = useQueryClient();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);

  const handleWorkspaceChange = async (selectedWorkspace: Workspace) => {
    setWorkspace(selectedWorkspace);
    setWorkspaceID(selectedWorkspace.id);
    try {
      const workspaceBoards = await queryClient.ensureQueryData({
        queryKey: ["boards", selectedWorkspace.id],
        queryFn: () => getBoards(selectedWorkspace.id),
        staleTime: 60_000,
      });
      if (workspaceBoards.length > 0) {
        const firstBoard = workspaceBoards[0];
        setBoard(firstBoard.id);
        setBoardRole(firstBoard.role);
        router.push(`/workspace/${selectedWorkspace.id}/board/${firstBoard.id}`);
        setWorkspaceSwitcherOpen(false);
        onMobileClose?.();
        return;
      }
      onMobileClose?.();
      router.push(`/workspace/${selectedWorkspace.id}`);
    } catch {
      onMobileClose?.();
      router.push(`/workspace/${selectedWorkspace.id}`);
    }
  };

  const handleBoardChange = (board: any) => {
    if (board.id === boardId) { onMobileClose?.(); return; }
    setNavigatingBoardId(board.id);
    setBoard(board.id);
    setBoardRole(board.role);
    onMobileClose?.();
    startTransition(() => {
      router.push(`/workspace/${workspaceId}/board/${board.id}`);
    });
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      await deleteWorkspaceDoc(workspaceId, docId);
      queryClient.invalidateQueries({ queryKey: ["workspace-docs", workspaceId] });
      if (activeDocId === docId) router.push(`/workspace/${workspaceId}`);
    } catch {}
  };

  const { user } = useAuth();

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
          "flex h-full flex-col overflow-hidden bg-background",
          "w-[270px]",
          "md:w-auto md:transition-all md:duration-300 md:ease-in-out",
          isOpen ? "md:max-w-[270px]" : "md:max-w-0",
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="text-sm font-bold tracking-tight text-foreground">
            Workspace
          </Link>
          <div className="flex items-center gap-1">
            {workspace?.id && (
              <ManageWorkspaceDropDown
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                workspaceVisibility={(workspace as any).visibility ?? "PRIVATE"}
                onBeforeOpen={onMobileClose}
              />
            )}
            <button
              onClick={onToggle}
              className="hidden rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onMobileClose}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Workspace switcher + create */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div data-tour="workspace-switcher" className="flex-1 min-w-0">
            <WorkspaceSwitcher
              workspaces={workspaces}
              workspace={workspace}
              onWorkspaceChange={handleWorkspaceChange}
              open={workspaceSwitcherOpen}
              setOpen={setWorkspaceSwitcherOpen}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-tour="create-btn"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Create workspace or board"
              >
                <Plus className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max">
              <DropdownMenuItem className="cursor-pointer" onClick={() => { onMobileClose?.(); setIsCreateWorkspaceOpen(true); }}>
                <Building2 className="mr-2 h-4 w-4" />
                Create Workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { onMobileClose?.(); setIsCreateBoardOpen(true); }} disabled={!workspace} className="cursor-pointer">
                <SquareKanban className="mr-2 h-4 w-4" />
                Create Board
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onMobileClose?.(); setIsCreateDocOpen(true); }} disabled={!workspace} className="cursor-pointer">
                <FileText className="mr-2 h-4 w-4" />
                Create Doc
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Workspace Home */}
          {workspaceId > 0 && (
            <Link
              href={`/workspace/${workspaceId}`}
              onClick={() => onMobileClose?.()}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium transition-colors mb-1",
                !boardId && !activeDocId
                  ? "bg-primary/10 text-primary font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Home className="h-3.5 w-3.5 shrink-0" />
              Workspace home
            </Link>
          )}

          {/* Content section */}
          <div className="mt-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <button
                onClick={() => setIsContentExpanded(!isContentExpanded)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transform transition-transform duration-200",
                    !isContentExpanded && "-rotate-90",
                  )}
                />
                Content
              </button>

              {/* Inline "+" for creating board or doc */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-0.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100 [.group:hover_&]:opacity-100"
                    style={{ opacity: 1 }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => { onMobileClose?.(); setIsCreateBoardOpen(true); }} disabled={!workspace} className="cursor-pointer text-xs">
                    <LayoutGrid className="mr-2 h-3.5 w-3.5" />
                    Add board
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onMobileClose?.(); setIsCreateDocOpen(true); }} disabled={!workspace} className="cursor-pointer text-xs">
                    <FileText className="mr-2 h-3.5 w-3.5" />
                    Add doc
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isContentExpanded && (
              <div data-tour="boards-list" className="mt-1 flex flex-col gap-0.5">
                {isBoardsLoading ? (
                  <div className="px-3.5 py-2 text-xs text-muted-foreground">Loading…</div>
                ) : (
                  <>
                    {/* Boards */}
                    {boards.map((item: any) => {
                      const isActive = boardId === item.id;
                      return (
                        <div
                          key={`board-${item.id}`}
                          className={cn(
                            "group flex w-full items-center justify-between gap-2 rounded-md px-3.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                            isActive && "bg-primary/10 font-semibold text-primary shadow-sm hover:bg-primary/20",
                          )}
                          onMouseEnter={() => {
                            if (item.id !== boardId) {
                              prefetchTimerRef.current = setTimeout(() => {
                                queryClient.prefetchQuery({
                                  queryKey: ["board", item.id, "", ""],
                                  queryFn: () => getBoardDetail(item.id),
                                  staleTime: 30_000,
                                });
                              }, 200);
                            }
                          }}
                          onMouseLeave={() => { if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current); }}
                        >
                          <button
                            type="button"
                            onClick={() => handleBoardChange(item)}
                            disabled={isNavigating && navigatingBoardId === item.id}
                            className="flex flex-1 cursor-pointer items-center gap-2 truncate text-left"
                          >
                            <SquareKanban className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            <span className="truncate">{item.name}</span>
                            {navigatingBoardId === item.id && isNavigating && (
                              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                            )}
                          </button>
                          {(item.role === "OWNER" || item.role === "ADMIN") && workspace && (
                            <ManageBoardDropdown
                              boardId={item.id}
                              boardName={item.name}
                              workspaceId={workspace.id}
                              onBeforeOpen={onMobileClose}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Docs */}
                    {docs.map((doc: any) => {
                      const isActive = activeDocId === doc.id;
                      return (
                        <div
                          key={`doc-${doc.id}`}
                          className={cn(
                            "group flex w-full items-center justify-between gap-2 rounded-md px-3.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                            isActive && "bg-primary/10 font-semibold text-primary shadow-sm hover:bg-primary/20",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onMobileClose?.();
                              router.push(`/workspace/${workspaceId}/doc/${doc.id}`);
                            }}
                            className="flex flex-1 cursor-pointer items-center gap-2 truncate text-left"
                          >
                            <span className="shrink-0 text-sm leading-none">{doc.emoji ?? "📄"}</span>
                            <span className="truncate">{doc.name}</span>
                          </button>

                          {/* Doc action menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100">
                                <Ellipsis className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                className="cursor-pointer text-xs text-red-600 focus:text-red-700"
                                onClick={() => handleDeleteDoc(doc.id)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}

                    {/* Empty state — clickable "Add content" card */}
                    {boards.length === 0 && docs.length === 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="mx-2 mt-1 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background">
                              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">Add content</p>
                              <p className="text-[10px] text-muted-foreground">Create or add content</p>
                            </div>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem
                            onClick={() => { onMobileClose?.(); setIsCreateBoardOpen(true); }}
                            disabled={!workspace}
                            className="cursor-pointer text-xs"
                          >
                            <LayoutGrid className="mr-2 h-3.5 w-3.5" />
                            Add board
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { onMobileClose?.(); setIsCreateDocOpen(true); }}
                            disabled={!workspace}
                            className="cursor-pointer text-xs"
                          >
                            <FileText className="mr-2 h-3.5 w-3.5" />
                            Add doc
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom links */}
        {workspace?.id && <ChatNavLink workspaceId={workspace.id} />}
        <Link
          href="/help"
          data-tour="help-link"
          className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HelpCircle strokeWidth={1.5} className="h-4 w-4" />
          Help & Guide
        </Link>
        {user?.systemRole === "SUPER_ADMIN" && (
          <Link
            href="/system-settings"
            className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Cog strokeWidth={1.5} className="h-4 w-4" />
            System Settings
          </Link>
        )}
      </div>

      {/* Desktop re-open handle */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-1/2 z-50 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow hover:bg-muted hover:text-foreground md:flex"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Modals */}
      <CreateWorkspaceModal isOpen={isCreateWorkspaceOpen} onClose={() => setIsCreateWorkspaceOpen(false)} />
      {workspace && (
        <CreateBoardModal isOpen={isCreateBoardOpen} onClose={() => setIsCreateBoardOpen(false)} workspaceId={workspace.id} />
      )}
      {workspace && (
        <DocCreateModal open={isCreateDocOpen} onClose={() => setIsCreateDocOpen(false)} workspaceId={workspace.id} />
      )}
    </div>
  );
}
