"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { WorkspaceCover } from "../components/workspace-cover";
import { WorkspaceHeader } from "../components/workspace-header";
import { BoardTable } from "../components/table/table";
import { AddBoardCard } from "../components/AddBoardCard";

import { getWorkspaceDetail } from "@/services/workspace.api";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";

import { FolderOpen } from "lucide-react";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&q=80";

function formatUpdatedAt(value: string) {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(updatedAt);
}

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();

  const workspaceId = Number(params.workspaceId);

  const canFetchWorkspace =
    Number.isInteger(workspaceId) && workspaceId > 0;

  const { user } = useAuth();

  const {
    setWorkspace,
    setWorkspaceRole,
  } = useInviteModalStore();

  const {
    data: workspaceDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspaceDetail(workspaceId),
    enabled: canFetchWorkspace,
    retry: false,
  });

  /**
   * Store workspace ID for the existing invite modal/store.
   */
  useEffect(() => {
    if (!canFetchWorkspace) return;

    setWorkspace(workspaceId);
  }, [workspaceId, canFetchWorkspace, setWorkspace]);

  /**
   * Determine current user's workspace role.
   */
  useEffect(() => {
    if (!workspaceDetail || !user?.id) {
      setWorkspaceRole("");
      return;
    }

    const member = workspaceDetail.members?.find(
      (member) => member.userId === user.id,
    );

    setWorkspaceRole(member?.role ?? "");
  }, [workspaceDetail, user?.id, setWorkspaceRole]);

  /**
   * Determine whether current user is workspace owner.
   */
  const isOwner = useMemo(() => {
    if (!workspaceDetail || !user?.id) {
      return false;
    }

    return Boolean(
      workspaceDetail.members?.some(
        (member) =>
          member.userId === user.id &&
          member.role === "OWNER",
      ),
    );
  }, [workspaceDetail, user?.id]);

  const currentUserRole = useMemo(() => {
    if (!workspaceDetail || !user?.id) return "";
    const member = workspaceDetail.members?.find((m) => m.userId === user.id);
    return member?.role ?? "";
  }, [workspaceDetail, user?.id]);

  /**
   * Workspace UI model.
   */
  const workspace = useMemo(() => {
    if (!workspaceDetail) {
      return null;
    }

    return {
      id: workspaceDetail.id,
      name: workspaceDetail.name,
      description:
        workspaceDetail.description ||
        "Manage your workspace boards and members.",
      cover: DEFAULT_COVER,
      avatar: workspaceDetail.name.charAt(0).toUpperCase(),

      members:
        workspaceDetail._count?.members ??
        workspaceDetail.members?.length ??
        0,

      boards:
        workspaceDetail._count?.boards ??
        workspaceDetail.boards?.length ??
        0,

      visibility: workspaceDetail.visibility,
      createdById: workspaceDetail.createdById,

      _count: workspaceDetail._count,

      isOwner,
    };
  }, [workspaceDetail, isOwner]);

  /**
   * Boards displayed in the workspace.
   */
  const boards = useMemo(() => {
    return (
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
      })) ?? []
    );
  }, [workspaceDetail]);

  /**
   * Invalid workspace route.
   */
  if (!canFetchWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            No workspace found
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find this workspace. It may have been deleted,
            you may not have access to it, or you haven't created one yet.
          </p>

          <p className="mt-6 text-sm font-medium text-muted-foreground">
            Create a workspace to get started.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Workspace loading state.
   */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  /**
   * Workspace error state.
   */
  if (isError || !workspaceDetail || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <WorkspaceCover image={workspace.cover} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
        <WorkspaceHeader
          workspace={workspace}
          membersDetail={workspaceDetail.members ?? []}
          invitations={(workspaceDetail.invitations ?? []) as any}
          currentUserRole={currentUserRole}
        />

        <div className="mt-6">
          {boards.length > 0 ? (
            <BoardTable boards={boards} workspaceId={workspace.id} />
          ) : (
            <AddBoardCard workspaceId={workspace.id} />
          )}
        </div>
      </div>
    </div>
  );
}