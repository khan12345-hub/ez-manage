"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { WorkspaceCover } from "../components/workspace-cover";
import { WorkspaceHeader } from "../components/workspace-header";
import { BoardTable } from "../components/table/table";
import { getWorkspaceDetail } from "@/services/workspace.api";
import { useAuth } from "@/providers/AuthProvider";
import { AddBoardCard } from "../components/AddBoardCard";
import { useInviteModalStore } from "@/store/invite-modal";

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
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const canFetchWorkspace = Number.isFinite(workspaceId) && workspaceId > 0;
  const { user } = useAuth();
  const [updatedWorkspace, setUpdatedWorkspace] = useState<any>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const { setWorkspace, setWorkspaceRole } = useInviteModalStore();

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

  useEffect(() => {
    if(workspaceDetail){
      setWorkspaceRole(workspaceDetail.role);
    }
  }, [workspaceDetail]);

  useEffect(() => {
    setWorkspace(workspaceId);
  }, [workspaceId]);

  const isOwner = useMemo(() => {
    if (!workspaceDetail || !user) return false;
    const ownerMember = workspaceDetail.members?.find(
      (member: any) => member.userId === user.id && member.role === "OWNER",
    );
    return !!ownerMember;
  }, [workspaceDetail, user]);

  const workspace = useMemo(() => {
    if (!workspaceDetail) return null;

    return {
      id: workspaceDetail.id,
      name: workspaceDetail.name,
      description:
        workspaceDetail.description ||
        "Manage your workspace boards and members.",
      cover: DEFAULT_COVER,
      avatar: workspaceDetail.name.charAt(0).toUpperCase(),
      members: workspaceDetail._count?.members
        ? workspaceDetail.members.length
        : 0,
      boards: workspaceDetail._count?.boards
        ? workspaceDetail.boards.length
        : 0,
      visibility: workspaceDetail.visibility,
      createdById: workspaceDetail.createdById,
      _count: workspaceDetail._count,
      isOwner,
    };
  }, [workspaceDetail, isOwner]);

  const boards = useMemo(() => {
    return (
      workspaceDetail?.boards.map((board) => ({
        id: board.id,
        name: board.name,
        owner: board.createdBy
          ? `${board.createdBy.firstName} ${board.createdBy.lastName}`
          : "Unknown",
        visibility: board.visibility,
        members: board._count?.members ?? 0,
        tasks: 0,
        updatedAt: formatUpdatedAt(board.updatedAt),
      })) ?? []
    );
  }, [workspaceDetail]);

  if (!canFetchWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Invalid workspace.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (isError || !workspace || !workspaceDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <WorkspaceCover image={workspace.cover} />

      <div className="mx-auto max-w-7xl px-8 pb-10">
        <WorkspaceHeader
          workspace={workspace}
          onWorkspaceUpdate={setUpdatedWorkspace}
        />

        {/* <WorkspaceTabs workspace={workspace} /> */}

        {/* <div className="mt-8">
          <WorkspaceToolbar />
        </div> */}

        {boards.length > 0 ? (
          <div className="mt-6">
            <BoardTable boards={boards} />
          </div>
        ) : (
          <AddBoardCard workspaceId={workspace.id} />
        )}
      </div>
    </div>
  );
}
