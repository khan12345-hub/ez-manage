"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Sparkles, UserPlus, ChevronDown, ChevronUp, Clock, Trash2, Link2, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { FormInput } from "./form/FormInput";
import { FormSelect } from "./form/FormSelect";
import { useCreateInvitation } from "@/services/invitation/invitation.hooks";
import { getPendingInvitations, revokeInvitation, generateWorkspaceInviteLink } from "@/services/invitation/invitation.api";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import { Board, Workspace } from "@repo/shared";
import { AppSelect } from "./ui/AppSelect";
import { getBoards, getBoardGroups } from "@/services/boards.api";
import { FormMultiSelect } from "./form/FormMultiSelect";
import { useInviteModalStore } from "@/store/invite-modal";
import { getUserByEmail } from "@/services/users.api";
import { cn } from "@/lib/utils";

// Zod validation schema
const inviteSchema = z.object({
  email: z.email("Please enter a valid email address"),
  workspaceId: z
    .number("Workspace is required")
    .positive("Workspace is required"),

  boardIds: z.array(z.number()).min(1, "Please select at least one board"),

  role: z.string("Role is required"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

// boardGroupAccess state: boardId → 'all' | number[] (specific group ids)
type BoardGroupAccessState = Record<number, "all" | number[]>;

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
  boardId?: number;
}

export const ROLE_OPTIONS = [
  { name: "Member", value: "MEMBER", id: 1 },
  { name: "Admin", value: "ADMIN", id: 2 },
  { name: "Owner", value: "OWNER", id: 3 },
  { name: "Viewer", value: "VIEWER", id: 4 },
  { name: "Guest", value: "GUEST", id: 5 },
];

const ROLE_INFO: Record<string, { border: string; bg: string; iconBg: string; textColor: string; icon: string; title: string; desc: string; perms: string[]; restrictions: string[] }> = {
  OWNER: {
    border: "border-amber-200", bg: "bg-amber-50", iconBg: "bg-amber-100", textColor: "text-amber-800",
    icon: "👑", title: "Owner",
    desc: "Full unrestricted access to the entire workspace.",
    perms: ["Full workspace control & settings", "Delete or transfer workspace", "Manage all members and roles", "Access every board and resource", "Override any permission"],
    restrictions: [],
  },
  ADMIN: {
    border: "border-indigo-200", bg: "bg-indigo-50", iconBg: "bg-indigo-100", textColor: "text-indigo-800",
    icon: "🛡️", title: "Admin",
    desc: "Manages people and boards but cannot delete the workspace.",
    perms: ["Manage workspace members", "Change member roles (except Owner)", "Create, edit and delete boards", "Access all workspace settings"],
    restrictions: ["Cannot delete the workspace"],
  },
  MEMBER: {
    border: "border-slate-200", bg: "bg-slate-50", iconBg: "bg-slate-100", textColor: "text-slate-700",
    icon: "👤", title: "Member",
    desc: "Standard collaborator with access to assigned boards only.",
    perms: ["View and work on assigned boards", "Comment and update tasks"],
    restrictions: ["Cannot manage workspace settings", "Cannot invite or remove members", "Cannot create boards"],
  },
  VIEWER: {
    border: "border-green-200", bg: "bg-green-50", iconBg: "bg-green-100", textColor: "text-green-800",
    icon: "👁️", title: "Viewer",
    desc: "Read-only access — can view but not make changes.",
    perms: ["View boards and tasks", "Read comments and activity"],
    restrictions: ["Cannot edit or create tasks", "Cannot comment", "Cannot manage any settings"],
  },
  GUEST: {
    border: "border-orange-200", bg: "bg-orange-50", iconBg: "bg-orange-100", textColor: "text-orange-800",
    icon: "🔗", title: "Guest",
    desc: "Limited access to specific boards — ideal for external collaborators.",
    perms: ["Access only explicitly shared boards", "View and comment on assigned tasks"],
    restrictions: ["Cannot see other boards or members", "Cannot access workspace settings", "Cannot invite others"],
  },
};

function BoardGroupSelector({
  boardId,
  boardName,
  value,
  onChange,
}: {
  boardId: number;
  boardName: string;
  value: "all" | number[];
  onChange: (v: "all" | number[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["board-groups", boardId],
    queryFn: () => getBoardGroups(boardId),
    staleTime: 60_000,
  });

  const isAll = value === "all";
  const selectedIds = isAll ? [] : (value as number[]);

  function toggleGroup(groupId: number) {
    const current = isAll ? [] : (value as number[]);
    if (current.includes(groupId)) {
      const next = current.filter((id) => id !== groupId);
      onChange(next.length === 0 ? [] : next);
    } else {
      onChange([...current, groupId]);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 truncate">
            {boardName}
          </span>
          <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
            {isAll ? "All groups" : `${selectedIds.length} group${selectedIds.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-white px-3 py-2 space-y-1.5">
          {isLoading ? (
            <p className="text-xs text-gray-400 py-1">Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No groups found</p>
          ) : (
            <>
              {/* All groups option */}
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="radio"
                  checked={isAll}
                  onChange={() => onChange("all")}
                  className="accent-indigo-600"
                />
                <span className="text-xs text-gray-700 font-medium">All groups</span>
              </label>

              {/* Specific groups */}
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="radio"
                  checked={!isAll}
                  onChange={() => onChange([])}
                  className="accent-indigo-600"
                />
                <span className="text-xs text-gray-700 font-medium">Specific groups</span>
              </label>

              {!isAll && (
                <div className="pl-5 mt-1 space-y-1">
                  {groups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 cursor-pointer py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        className="accent-indigo-600"
                      />
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: group.color || "#94a3b8" }}
                      />
                      <span className="text-xs text-gray-600 truncate">{group.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function InviteModal() {
  const createInvitationMutation = useCreateInvitation();
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      workspaceId: undefined,
      boardIds: [],
      role: undefined,
    },
  });
  const { watch, setValue, reset, getValues } = form;

  const selectedWorkspaceId = watch("workspaceId");
  const selectedBoardIds = watch("boardIds");
  const selectedRole = watch("role");

  const [boardGroupAccess, setBoardGroupAccess] = useState<BoardGroupAccessState>({});
  const [activeTab, setActiveTab] = useState<"invite" | "pending" | "link">("invite");
  const [revoking, setRevoking] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState("MEMBER");
  const [linkExpiry, setLinkExpiry] = useState<number | undefined>(7);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    retry: false,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", selectedWorkspaceId],
    queryFn: () => getBoards(selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });

  const { isOpen, close, workspaceId, boardId } = useInviteModalStore();

  const { data: pendingInvitations = [], refetch: refetchPending } = useQuery({
    queryKey: ["pending-invitations", selectedWorkspaceId],
    queryFn: () => getPendingInvitations(selectedWorkspaceId!),
    enabled: !!selectedWorkspaceId,
  });

  const handleRevoke = async (id: number) => {
    setRevoking(id);
    try {
      await revokeInvitation(id);
      refetchPending();
      toast.success("Invitation revoked");
    } catch {
      toast.error("Failed to revoke invitation");
    } finally {
      setRevoking(null);
    }
  };
  const email = watch("email");
  const { data: existingUser, isFetching: checkingUser } = useQuery({
    queryKey: ["user-by-email", email],
    queryFn: () => getUserByEmail(email),
    enabled: z.email().safeParse(email).success,
    retry: false,
    staleTime: 60_000,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (workspaceId) {
      setValue("workspaceId", workspaceId);
    }

    if (boardId) {
      setValue("boardIds", [boardId]);
    }
  }, [isOpen, workspaceId, boardId]);

  // Clean up boardGroupAccess when board selection changes
  useEffect(() => {
    setBoardGroupAccess((prev) => {
      const next: BoardGroupAccessState = {};
      for (const id of selectedBoardIds) {
        next[id] = prev[id] ?? "all";
      }
      return next;
    });
  }, [selectedBoardIds.join(",")]);

  const onSubmit = (values: InviteFormValues) => {
    // Build boardGroupAccess payload — only include boards with specific group restrictions
    const boardGroupAccessPayload = Object.entries(boardGroupAccess)
      .filter(([, v]) => v !== "all" && (v as number[]).length > 0)
      .map(([boardId, groupIds]) => ({
        boardId: Number(boardId),
        groupIds: groupIds as number[],
      }));

    createInvitationMutation.mutate(
      {
        ...values,
        ...(boardGroupAccessPayload.length > 0
          ? { boardGroupAccess: boardGroupAccessPayload }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(existingUser ? `Successfully Added` : `Successfully invited!`);
          close();
        },
        onError: (error: any) => {
          const errorMsg =
            error?.response?.data?.message ||
            "Failed to send invitation. Please try again.";
          toast.error(errorMsg);
        },
      },
    );
  };

  const selectedBoardObjects = boards.filter((b: any) =>
    selectedBoardIds.includes(b.id),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl p-6! transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        {/* Close Button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              Invite Team Member
              <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse" />
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Add user to work together on your workspaces and boards.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("invite")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${activeTab === "invite" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            Invite Member
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${activeTab === "pending" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Clock className="h-3 w-3" />
            Pending
            {pendingInvitations.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                {pendingInvitations.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("link")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${activeTab === "link" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Link2 className="h-3 w-3" />
            Share Link
          </button>
        </div>

        {/* Pending Invitations View */}
        {activeTab === "pending" && (
          <div className="flex flex-col gap-2">
            {!selectedWorkspaceId ? (
              <p className="text-center text-xs text-gray-400 py-6">Select a workspace to view pending invitations</p>
            ) : pendingInvitations.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">No pending invitations</p>
            ) : (
              pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-800">{inv.email}</p>
                    <p className="text-[10px] text-gray-400">
                      {inv.role} · Invited by {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revoking === inv.id}
                    className="ml-3 rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title="Revoke invitation"
                  >
                    {revoking === inv.id ? "…" : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Share Link Tab */}
        {activeTab === "link" && (
          <div className="flex flex-col gap-4">
            {!selectedWorkspaceId ? (
              <p className="text-center text-xs text-gray-400 py-6">
                Select a workspace on the Invite tab first, then come back here to generate a link.
              </p>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block mb-1 text-xs font-medium text-gray-600">Role</label>
                    <select
                      value={linkRole}
                      onChange={(e) => setLinkRole(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="GUEST">Guest</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1 text-xs font-medium text-gray-600">Expires in</label>
                    <select
                      value={linkExpiry ?? ""}
                      onChange={(e) => setLinkExpiry(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">Never</option>
                      <option value="1">1 day</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </div>
                </div>

                {generatedLink ? (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-500">Shareable link</p>
                    <div className="flex items-center gap-2">
                      <p className="flex-1 truncate rounded bg-white px-2 py-1.5 text-xs font-mono text-gray-700 border border-indigo-100">
                        {generatedLink}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLink);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
                      >
                        {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-indigo-400">
                      Anyone with this link can join as {linkRole.charAt(0) + linkRole.slice(1).toLowerCase()}.
                      {linkExpiry ? ` Expires in ${linkExpiry} day${linkExpiry > 1 ? "s" : ""}.` : " Never expires."}
                    </p>
                  </div>
                ) : null}

                <Button
                  type="button"
                  onClick={async () => {
                    setGeneratingLink(true);
                    try {
                      const result = await generateWorkspaceInviteLink(selectedWorkspaceId, linkRole, linkExpiry);
                      setGeneratedLink(result.url);
                    } catch (e: any) {
                      toast.error(e?.response?.data?.message ?? "Failed to generate link");
                    } finally {
                      setGeneratingLink(false);
                    }
                  }}
                  disabled={generatingLink}
                  className="h-9 gap-2 text-xs"
                >
                  {generatingLink ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {generatedLink ? "Generate new link" : "Generate invite link"}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Form */}
        {activeTab === "invite" && <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormInput
              name="email"
              label="Email Address"
              placeholder="e.g. muhammadali@ezaccounts.ca"
            />

            {checkingUser && (
              <p className="text-xs text-muted-foreground">Checking user...</p>
            )}

            {existingUser && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
                    {existingUser.firstName[0]}
                    {existingUser.lastName[0]}
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      {existingUser.firstName} {existingUser.lastName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Existing EzManage user. They will be added directly to the
                      selected boards.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {email &&
              !checkingUser &&
              !existingUser &&
              z.email().safeParse(email).success && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm font-medium">New user</p>

                  <p className="text-xs text-muted-foreground">
                    An invitation email will be sent after you click Continue.
                  </p>
                </div>
              )}

            <FormSelect
              name="workspaceId"
              label="Workspace"
              placeholder="Select Workspace"
              valueType="number"
              options={workspaces}
              disabled={!!workspaceId}
              className="h-9.5 text-sm"
            />
            <FormMultiSelect
              name="boardIds"
              label="Board"
              placeholder="Select Board"
              options={boards}
              className="h-9.5 text-sm"
            />

            {/* Group access per board */}
            {selectedBoardObjects.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  Group Access
                </p>
                {selectedBoardObjects.map((board: any) => (
                  <BoardGroupSelector
                    key={board.id}
                    boardId={board.id}
                    boardName={board.name}
                    value={boardGroupAccess[board.id] ?? "all"}
                    onChange={(v) =>
                      setBoardGroupAccess((prev) => ({ ...prev, [board.id]: v }))
                    }
                  />
                ))}
              </div>
            )}

            <FormSelect
              name="role"
              label="Access Role"
              placeholder="Select role"
              valueType="string"
              options={ROLE_OPTIONS}
              className="h-9.5 text-sm"
            />

            {/* Role description card */}
            {selectedRole && ROLE_INFO[selectedRole] && (() => {
              const info = ROLE_INFO[selectedRole];
              return (
                <div className={`rounded-lg border ${info.border} ${info.bg} p-3 -mt-1 transition-all`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md text-sm ${info.iconBg}`}>{info.icon}</span>
                    <span className={`text-xs font-semibold ${info.textColor}`}>{info.title} Access</span>
                  </div>
                  <p className={`text-[11px] ${info.textColor} opacity-80 mb-2`}>{info.desc}</p>
                  <div className="space-y-1">
                    {info.perms.map((p) => (
                      <div key={p} className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-green-500 shrink-0 text-[10px]">✓</span>
                        <span className={`text-[11px] ${info.textColor}`}>{p}</span>
                      </div>
                    ))}
                    {info.restrictions.map((r) => (
                      <div key={r} className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-red-400 shrink-0 text-[10px]">✕</span>
                        <span className="text-[11px] text-gray-500">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className="h-9.5 px-4 font-semibold text-xs border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9.5 px-4 font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                {createInvitationMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Inviting...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </div>
          </form>
        </FormProvider>}
      </div>
    </div>
  );
}
