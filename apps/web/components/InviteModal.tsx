"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Sparkles, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { FormInput } from "./form/FormInput";
import { FormSelect } from "./form/FormSelect";
import { useCreateInvitation } from "@/services/invitation/invitation.hooks";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import { Board, Workspace } from "@repo/shared";
import { AppSelect } from "./ui/AppSelect";
import { getBoards } from "@/services/boards.api";
import { FormMultiSelect } from "./form/FormMultiSelect";
import { useInviteModalStore } from "@/store/invite-modal";
import { getUserByEmail } from "@/services/users.api";

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

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
  boardId?: number;
}

const ROLE_OPTIONS = [
  { name: "Member", value: "MEMBER", id: 1 },
  { name: "Admin", value: "ADMIN", id: 2 },
  { name: "Owner", value: "OWNER", id: 3 },
  // { name: "Viewer", value: "VIEWER", id: 4 },
];

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

  // Reset boardIds if selected workspace changes
  // useEffect(() => {
  //   setValue("boardIds", []);
  // }, [selectedWorkspaceId, setValue]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) return;

    if (workspaceId) {
      setValue("workspaceId", workspaceId);
    }

    if (boardId) {
      setValue("boardIds", [boardId]);
    }

    console.log("after setValue", getValues("boardIds"));
  }, [isOpen, workspaceId, boardId]);

  const onSubmit = (values: InviteFormValues) => {
    createInvitationMutation.mutate(values, {
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
    });
  };

  // write tanstack query to get all workspaces

  // Get active boards based on selected workspace

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl p-6! transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
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
                // disabled={createInvitationMutation.isPending}
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
