"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Trash2, Users, Mail, Clock, UserCheck } from "lucide-react";

import { Button } from "./ui/button";
import {
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from "@/services/workspace.api";

export interface MemberDetail {
  id: number;
  role: string;
  userId: number;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface InvitationDetail {
  id: number;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  members: MemberDetail[];
  invitations?: InvitationDetail[];
  currentUserRole: string;
}

const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER", "VIEWER", "GUEST"] as const;

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
  GUEST: "Guest",
};

function avatarInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function WorkspaceMembersModal({
  isOpen,
  onClose,
  workspaceId,
  members,
  invitations = [],
  currentUserRole,
}: Props) {
  const queryClient = useQueryClient();
  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: string }) =>
      updateWorkspaceMemberRole(workspaceId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success("Member role updated.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to update role.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) =>
      removeWorkspaceMember(workspaceId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success("Member removed.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to remove member.");
    },
  });

  if (!isOpen || typeof document === "undefined") return null;

  const pendingCount = invitations.filter((i) => i.status === "PENDING").length;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
      >
        {/* top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* header */}
        <div className="flex items-start gap-3.5 px-6 pt-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Workspace Members
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
              {members.length} {members.length === 1 ? "member" : "members"}
              {pendingCount > 0 && ` · ${pendingCount} pending invite${pendingCount !== 1 ? "s" : ""}`}
              {canManage && " — you can edit roles and remove members"}
            </p>
          </div>
        </div>

        {/* tabs */}
        <div className="flex border-b border-gray-100 px-6 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-1.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 mr-5 transition-colors ${
              activeTab === "members"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Members
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
              {members.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={`flex items-center gap-1.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "invitations"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Invitations
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* member list */}
        {activeTab === "members" && (
          <div className="max-h-[380px] overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-2">
              {members.map((m) => {
                const isOwner = m.role === "OWNER";
                const isBusy = roleMutation.isPending || removeMutation.isPending;

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    {/* avatar */}
                    {m.user.avatarUrl ? (
                      <img
                        src={m.user.avatarUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {avatarInitials(m.user.firstName, m.user.lastName)}
                      </div>
                    )}

                    {/* name + join date */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {m.user.firstName} {m.user.lastName}
                      </p>
                      {m.createdAt && (
                        <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Joined {formatDate(m.createdAt)}
                        </p>
                      )}
                    </div>

                    {/* role selector / badge */}
                    {canManage && !isOwner ? (
                      <select
                        value={m.role}
                        disabled={isBusy}
                        onChange={(e) =>
                          roleMutation.mutate({
                            memberId: m.id,
                            role: e.target.value,
                          })
                        }
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    )}

                    {/* remove button */}
                    {canManage && !isOwner && (
                      <button
                        disabled={isBusy}
                        onClick={() => removeMutation.mutate(m.id)}
                        className="ml-1 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                        aria-label="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* invitations list */}
        {activeTab === "invitations" && (
          <div className="max-h-[380px] overflow-y-auto px-6 py-4">
            {invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail className="h-8 w-8 text-gray-300 dark:text-zinc-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-zinc-400">No pending invitations</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {inv.email}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                            Role: <span className="font-medium text-gray-700 dark:text-zinc-300">{ROLE_LABELS[inv.role] ?? inv.role}</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400">
                            <Clock className="h-3 w-3" />
                            Sent {formatDate(inv.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                          Invited by{" "}
                          <span className="font-medium text-gray-600 dark:text-zinc-400">
                            {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* footer */}
        <div className="flex justify-end border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
