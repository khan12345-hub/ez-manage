"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Sparkles, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { FormInput } from "./form/FormInput";
import { FormSelect } from "./form/FormSelect";
import { useCreateInvitation } from "@/services/invitation/invitation.hooks";
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

  const [boardGroupAccess, setBoardGroupAccess] = useState<BoardGroupAccessState>({});

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

        {/* Form */}
        <FormProvider {...form}>
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
        </FormProvider>
      </div>
    </div>
  );
}
