"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { WorkspaceCover } from "../components/workspace-cover";
import { WorkspaceHeader } from "../components/workspace-header";
import { WorkspacePageSkeleton } from "./WorkspacePageSkeleton";
import { BoardTable } from "../components/table/table";
import { WorkspaceChannelsCard } from "../components/WorkspaceChannelsCard";
import { CreateBoardModal } from "@/components/CreateBoardModal";

import { getWorkspaceDetail, updateWorkspaceMemberRole } from "@/services/workspace.api";
import { getRecentlyViewedBoards, getBoards } from "@/services/boards.api";
import { getAllChatUsers, getOrCreateDM, setUserStatus as apiSetUserStatus } from "@/services/chat.api";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";
import { useChatStore } from "@/store/chat-store";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfilePanel } from "@/components/UserProfilePanel";

import {
  FolderOpen, Clock, Home, FileText, Users,
  Plus, Layout, MessageSquare, Crown, Shield,
  Sparkles, ChevronRight, Zap,
} from "lucide-react";

import { resolveUrl } from "@/lib/resolveUrl";
const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&q=80";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", year: "numeric",
  }).format(d);
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { style: string; icon: React.ReactNode }> = {
    OWNER:  { style: "bg-amber-500/10 text-amber-700 border border-amber-200 dark:text-amber-400 dark:border-amber-900/50",   icon: <Crown  className="h-3 w-3" /> },
    ADMIN:  { style: "bg-indigo-500/10 text-indigo-700 border border-indigo-200 dark:text-indigo-400 dark:border-indigo-900/50", icon: <Shield className="h-3 w-3" /> },
    MEMBER: { style: "bg-muted text-muted-foreground border border-border",   icon: <Users  className="h-3 w-3" /> },
    VIEWER: { style: "bg-green-500/10 text-green-700 border border-green-200 dark:text-green-400 dark:border-green-900/50",   icon: <span className="text-[10px]">👁️</span> },
    GUEST:  { style: "bg-orange-500/10 text-orange-700 border border-orange-200 dark:text-orange-400 dark:border-orange-900/50", icon: <span className="text-[10px]">🔗</span> },
  };
  const cfg = map[role] ?? map.MEMBER;
  const label = role.charAt(0) + role.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.style}`}>
      {cfg.icon}
      {label}
    </span>
  );
}

// ─── AI section (Home tab) ────────────────────────────────────────────────────

interface AIChip {
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

interface WorkspaceAISectionProps {
  workspaceName: string;
  onCreateBoard: () => void;
  onInvite: () => void;
  onGoToContent: () => void;
  recentBoardHref?: string;
}

function WorkspaceAISection({
  workspaceName,
  onCreateBoard,
  onInvite,
  onGoToContent,
  recentBoardHref,
}: WorkspaceAISectionProps) {
  const router = useRouter();

  const chips: AIChip[] = [
    {
      label: "Help me build a board",
      icon: <Layout className="h-3 w-3" />,
      action: onCreateBoard,
    },
    {
      label: "What should I focus on today?",
      icon: <Zap className="h-3 w-3" />,
      action: () => recentBoardHref ? router.push(recentBoardHref) : onGoToContent(),
    },
    {
      label: "View all boards",
      icon: <FileText className="h-3 w-3" />,
      action: onGoToContent,
    },
    {
      label: "Invite team members",
      icon: <Users className="h-3 w-3" />,
      action: onInvite,
    },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 dark:from-indigo-950/50 dark:via-violet-950/50 dark:to-fuchsia-950/50 shadow-sm">
      <div className="flex items-start gap-4 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-bold text-foreground">Quick Actions</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Get started with <strong className="text-foreground">{workspaceName}</strong> — jump right in.
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={chip.action}
                className="flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 shadow-sm transition-all hover:bg-white dark:hover:bg-white/10 hover:shadow-md active:scale-95"
              >
                {chip.icon}
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Content empty state ──────────────────────────────────────────────────────

function ContentEmptyState({ onCreateBoard }: { onCreateBoard: () => void }) {
  return (
    <div>
      <p className="mb-5 text-sm font-semibold text-muted-foreground">
        Nothing to show here, yet
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={onCreateBoard}
          className="group flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-500/5 hover:shadow-md sm:h-36 sm:w-44"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 transition-all group-hover:border-indigo-300 group-hover:bg-indigo-500/10">
            <Plus className="h-6 w-6 text-muted-foreground/40 group-hover:text-indigo-500" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            Add new board
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Message button with loading state ───────────────────────────────────────

function MessageButton({
  workspaceId,
  userId,
  onSuccess,
}: {
  workspaceId: number;
  userId: number;
  onSuccess: (dmId: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(false);
    try {
      const dm = await getOrCreateDM(workspaceId, userId);
      onSuccess(dm.id);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "unknown";
      const status = err?.response?.status ?? "?";
      console.error(`[MessageButton] DM create failed ${status}:`, msg, err?.response?.data);
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-all group-hover:opacity-100 ${
        error
          ? "border-red-200 bg-red-500/10 text-red-600 dark:text-red-400 dark:border-red-900/50 opacity-100"
          : "border-border bg-background text-muted-foreground opacity-0 hover:border-indigo-200 hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400"
      } disabled:cursor-wait disabled:opacity-60`}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {loading ? "Opening…" : error ? "Failed, retry" : "Message"}
    </button>
  );
}

// ─── Tab definition ───────────────────────────────────────────────────────────

type Tab = "home" | "content" | "team";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home",    label: "Home",    icon: <Home     className="h-3.5 w-3.5" /> },
  { id: "content", label: "Content", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "team",    label: "Team",    icon: <Users    className="h-3.5 w-3.5" /> },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = Number(params.workspaceId);
  const canFetchWorkspace = Number.isInteger(workspaceId) && workspaceId > 0;

  const { user } = useAuth();
  const qc = useQueryClient();
  const { setWorkspace, setWorkspaceRole } = useInviteModalStore();
  const { onlineUserIds, setActiveChannel, userStatuses, setUserStatus: storeSetUserStatus } = useChatStore();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<{ memberId: number; memberName: string; oldRole: string; newRole: string } | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);

  const handleConfirmRole = async () => {
    if (!pendingRole) return;
    setSavingRoleId(pendingRole.memberId);
    try {
      await updateWorkspaceMemberRole(workspaceId, pendingRole.memberId, pendingRole.newRole);
      await qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setEditingMemberId(null);
    } catch { /* select reverts on refetch */ }
    finally { setSavingRoleId(null); setPendingRole(null); }
  };

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: workspaceDetail, isLoading, isError } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspaceDetail(workspaceId),
    enabled: canFetchWorkspace,
    retry: false,
  });

  const { data: recentBoards = [] } = useQuery({
    queryKey: ["recently-viewed-boards", workspaceId],
    queryFn: () => getRecentlyViewedBoards(workspaceId),
    enabled: canFetchWorkspace,
    staleTime: 60_000,
  });

  // Live boards — separate query so invalidation after create works immediately
  const { data: rawLiveBoards = [] } = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => getBoards(workspaceId),
    enabled: canFetchWorkspace && activeTab === "content",
    staleTime: 30_000,
  });

  const liveBoards = useMemo(
    () =>
      rawLiveBoards.map((b: any) => ({
        id: b.id,
        name: b.name,
        visibility: b.visibility,
        owner: b.createdBy ? `${b.createdBy.firstName} ${b.createdBy.lastName}` : "Unknown",
        members: b._count?.members ?? 0,
        tasks: (b.groups ?? []).reduce((s: number, g: any) => s + (g._count?.tasks ?? 0), 0),
        updatedAt: formatUpdatedAt(b.updatedAt),
      })),
    [rawLiveBoards],
  );

  // Load emails only when Team tab is open
  const { data: chatUsers = [] } = useQuery({
    queryKey: ["workspace-chat-users", workspaceId],
    queryFn: () => getAllChatUsers(workspaceId),
    enabled: canFetchWorkspace && activeTab === "team",
    staleTime: 120_000,
  });

  // ── effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canFetchWorkspace) return;
    setWorkspace(workspaceId);
  }, [workspaceId, canFetchWorkspace, setWorkspace]);

  useEffect(() => {
    if (!workspaceDetail || !user?.id) { setWorkspaceRole(""); return; }
    const member = workspaceDetail.members?.find((m) => m.userId === user.id);
    setWorkspaceRole(member?.role ?? "");
  }, [workspaceDetail, user?.id, setWorkspaceRole]);

  // ── derived state ─────────────────────────────────────────────────────────

  const isOwner = useMemo(
    () => Boolean(workspaceDetail?.members?.some(
      (m) => m.userId === user?.id && m.role === "OWNER",
    )),
    [workspaceDetail, user?.id],
  );

  const currentUserRole = useMemo(() => {
    const m = workspaceDetail?.members?.find((m) => m.userId === user?.id);
    return m?.role ?? "";
  }, [workspaceDetail, user?.id]);

  const workspace = useMemo(() => {
    if (!workspaceDetail) return null;
    return {
      id: workspaceDetail.id,
      name: workspaceDetail.name,
      description: workspaceDetail.description || "Manage your workspace boards and members.",
      cover: DEFAULT_COVER,
      avatar: workspaceDetail.name.charAt(0).toUpperCase(),
      members: workspaceDetail._count?.members ?? workspaceDetail.members?.length ?? 0,
      boards: workspaceDetail._count?.boards ?? workspaceDetail.boards?.length ?? 0,
      visibility: workspaceDetail.visibility,
      createdById: workspaceDetail.createdById,
      _count: workspaceDetail._count,
      isOwner,
    };
  }, [workspaceDetail, isOwner]);

  const boards = useMemo(
    () =>
      workspaceDetail?.boards?.map((board) => ({
        id: board.id,
        name: board.name,
        owner: board.createdBy
          ? `${board.createdBy.firstName} ${board.createdBy.lastName}`
          : "Unknown",
        visibility: board.visibility,
        members: board._count?.members ?? 0,
        tasks: (board.groups ?? []).reduce(
          (sum: number, g: any) => sum + (g._count?.tasks ?? 0),
          0,
        ),
        updatedAt: formatUpdatedAt(board.updatedAt),
      })) ?? [],
    [workspaceDetail],
  );

  // ── early returns ─────────────────────────────────────────────────────────

  if (!canFetchWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">No workspace found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find this workspace. It may have been deleted, you may not have access to it, or you haven't created one yet.
          </p>
          <p className="mt-6 text-sm font-medium text-muted-foreground">Create a workspace to get started.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <WorkspacePageSkeleton />;
  }

  if (isError || !workspaceDetail || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/30">
      <WorkspaceCover image={workspace.cover} />

      <div className="mx-auto max-w-7xl px-3 pb-10 sm:px-6 lg:px-8">
        <WorkspaceHeader
          workspace={workspace}
          membersDetail={workspaceDetail.members ?? []}
          invitations={(workspaceDetail.invitations ?? []) as any}
          currentUserRole={currentUserRole}
        />

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="mt-5 overflow-x-auto border-b border-border">
          <nav className="flex min-w-max" aria-label="Workspace tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-5 sm:py-3 ${
                  activeTab === tab.id
                    ? "text-indigo-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-indigo-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── HOME ────────────────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <>
            <WorkspaceAISection
              workspaceName={workspace.name}
              onCreateBoard={() => setIsCreateBoardOpen(true)}
              onInvite={() => useInviteModalStore.getState().open()}
              onGoToContent={() => setActiveTab("content")}
              recentBoardHref={
                recentBoards[0]
                  ? `/workspace/${workspaceId}/board/${recentBoards[0].id}`
                  : undefined
              }
            />

            {recentBoards.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Recently Viewed</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentBoards.map((b) => (
                    <Link
                      key={b.id}
                      href={`/workspace/${workspaceId}/board/${b.id}`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-all hover:bg-muted hover:shadow-md"
                    >
                      <span className="font-medium text-foreground">{b.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <WorkspaceChannelsCard workspaceId={workspaceId} />
            </div>
          </>
        )}

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        {activeTab === "content" && (
          <div className="mt-6">
            {liveBoards.length > 0 ? (
              <BoardTable boards={liveBoards} workspaceId={workspace.id} />
            ) : (
              <ContentEmptyState onCreateBoard={() => setIsCreateBoardOpen(true)} />
            )}
          </div>
        )}

        {/* ── TEAM ────────────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div className="mt-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
                    <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Users</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {workspaceDetail.members?.length ?? 0}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                        Name &amp; title
                      </th>
                      <th className="hidden whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell sm:px-6">
                        Email
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                        Role
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {workspaceDetail.members?.map((member) => {
                      const chatUser = chatUsers.find((u) => u.userId === member.userId);
                      const isOnline = onlineUserIds.has(member.userId);
                      const isCurrentUser = member.userId === user?.id;
                      return (
                        <tr
                          key={member.id}
                          className="group cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => setSelectedMember(member)}
                        >
                          {/* Name */}
                          <td className="px-4 py-3 sm:px-6 sm:py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage
                                    src={resolveUrl(member.user.avatarUrl) || undefined}
                                  />
                                  <AvatarFallback className="bg-indigo-500/10 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                    {member.user.firstName[0]}
                                    {member.user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                                  }`}
                                />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {member.user.firstName} {member.user.lastName}
                                  {isCurrentUser && (
                                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                                      (you)
                                    </span>
                                  )}
                                </p>
                                <p
                                  className={`text-[11px] font-medium ${
                                    isOnline ? "text-green-500" : "text-muted-foreground"
                                  }`}
                                >
                                  {isOnline ? "● Online" : "○ Offline"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="hidden px-4 py-4 sm:table-cell sm:px-6">
                            <span className="text-sm text-muted-foreground">
                              {(chatUser?.user as any)?.email ?? (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </span>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
                            {editingMemberId === member.id ? (
                              <select
                                defaultValue={member.role}
                                autoFocus
                                onChange={(e) => {
                                  if (e.target.value === member.role) return;
                                  setPendingRole({
                                    memberId: member.id,
                                    memberName: `${member.user.firstName} ${member.user.lastName}`,
                                    oldRole: member.role,
                                    newRole: e.target.value,
                                  });
                                }}
                                className="rounded-lg border border-indigo-300 bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                                <option value="VIEWER">Viewer</option>
                                <option value="GUEST">Guest</option>
                                {currentUserRole === "OWNER" && (
                                  <option value="OWNER">Owner</option>
                                )}
                              </select>
                            ) : (
                              <RoleBadge role={member.role} />
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {!isCurrentUser && (
                                <MessageButton
                                  workspaceId={workspaceId}
                                  userId={member.userId}
                                  onSuccess={(dmId) => {
                                    setActiveChannel(dmId);
                                    router.push(`/workspace/${workspaceId}/chat`);
                                  }}
                                />
                              )}
                              {/* Edit / Cancel button */}
                              {(currentUserRole === "OWNER" || currentUserRole === "ADMIN") &&
                              !isCurrentUser && member.role !== "OWNER" && (
                                editingMemberId === member.id ? (
                                  <button
                                    onClick={() => setEditingMemberId(null)}
                                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <button
                                    disabled={!!editingMemberId}
                                    onClick={() => setEditingMemberId(member.id)}
                                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    Edit
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Role change confirmation modal ──────────────────────────────────── */}
      {pendingRole && (() => {
        const ROLE_INFO: Record<string, { badge: string; perms: string[]; restrictions: string[] }> = {
          OWNER: {
            badge: "bg-amber-500/10 border-amber-200 text-amber-700 dark:text-amber-400 dark:border-amber-900/50",
            perms: ["Full workspace control & settings", "Delete or transfer workspace", "Manage all members and roles", "Access every board and resource", "Override any permission"],
            restrictions: [],
          },
          ADMIN: {
            badge: "bg-indigo-500/10 border-indigo-200 text-indigo-700 dark:text-indigo-400 dark:border-indigo-900/50",
            perms: ["Manage workspace members", "Change member roles (except Owner)", "Create, edit and delete boards", "Access all workspace settings"],
            restrictions: ["Cannot delete the workspace"],
          },
          MEMBER: {
            badge: "bg-muted border-border text-foreground",
            perms: ["View and work on assigned boards", "Comment and update tasks"],
            restrictions: ["Cannot manage workspace settings", "Cannot invite or remove members", "Cannot create boards"],
          },
          VIEWER: {
            badge: "bg-green-500/10 border-green-200 text-green-700 dark:text-green-400 dark:border-green-900/50",
            perms: ["View boards and tasks", "Read comments and activity"],
            restrictions: ["Cannot edit or create tasks", "Cannot comment", "Cannot manage any settings"],
          },
          GUEST: {
            badge: "bg-orange-500/10 border-orange-200 text-orange-700 dark:text-orange-400 dark:border-orange-900/50",
            perms: ["Access only explicitly shared boards", "View and comment on assigned tasks"],
            restrictions: ["Cannot see other boards or members", "Cannot access workspace settings", "Cannot invite others"],
          },
        };
        const info = ROLE_INFO[pendingRole.newRole] ?? ROLE_INFO.MEMBER;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setPendingRole(null)} />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
              {/* Header */}
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-sm font-bold text-foreground">Change Role</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update <span className="font-semibold text-foreground">{pendingRole.memberName}</span>'s role from{" "}
                  <span className="font-medium capitalize text-muted-foreground">{pendingRole.oldRole.toLowerCase()}</span>{" "}
                  to{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize">{pendingRole.newRole.toLowerCase()}</span>
                </p>
              </div>

              {/* Role permission card */}
              <div className="px-6 py-4">
                <div className={`rounded-xl border ${info.badge} p-4`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${info.badge}`}>
                      {pendingRole.newRole}
                    </span>
                    <span className="text-[11px] text-muted-foreground">permissions</span>
                  </div>
                  <ul className="space-y-1.5">
                    {info.perms.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-xs text-foreground">
                        <span className="mt-0.5 text-green-500 shrink-0">✓</span>
                        {p}
                      </li>
                    ))}
                    {info.restrictions.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-0.5 text-red-400 shrink-0">✕</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  This takes effect immediately. The affected user will see updated permissions after they refresh.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                <button
                  onClick={() => setPendingRole(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRole}
                  disabled={savingRoleId !== null}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {savingRoleId !== null ? "Updating…" : "Yes, update role"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {workspace && (
        <CreateBoardModal
          isOpen={isCreateBoardOpen}
          onClose={() => setIsCreateBoardOpen(false)}
          workspaceId={workspace.id}
        />
      )}

      {/* ── Member Profile Panel ──────────────────────────────────────────── */}
      {selectedMember && (() => {
        const m = selectedMember;
        const isOnline = onlineUserIds.has(m.userId);
        const isCurrentUser = m.userId === user?.id;
        const liveStatus = userStatuses[m.userId];
        return (
          <div className="fixed inset-0 z-50 flex items-stretch justify-end">
            {/* backdrop */}
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
              onClick={() => setSelectedMember(null)}
            />
            {/* panel */}
            <div className="relative flex h-full w-72 flex-col border-l border-border bg-background shadow-2xl">
              <UserProfilePanel
                user={m.user}
                fullUser={{
                  email: m.user.email,
                  phone: m.user.phone,
                  lastLoginAt: m.user.lastLoginAt,
                  createdAt: m.user.createdAt,
                }}
                isOnline={isOnline}
                isCurrentUser={isCurrentUser}
                workspaceId={workspaceId}
                statusEmoji={liveStatus?.emoji ?? m.user.chatStatusEmoji ?? null}
                statusText={liveStatus?.text ?? m.user.chatStatusText ?? null}
                onClose={() => setSelectedMember(null)}
                onSendMessage={!isCurrentUser ? async () => {
                  const dm = await getOrCreateDM(workspaceId, m.userId);
                  setActiveChannel(dm.id);
                  router.push(`/workspace/${workspaceId}/chat`);
                  setSelectedMember(null);
                } : undefined}
                onSetStatus={isCurrentUser ? async (emoji, text) => {
                  await apiSetUserStatus(emoji, text, null);
                  storeSetUserStatus(user!.id, emoji, text);
                } : undefined}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
