"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Globe2, Lock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";
import { createWorkspace } from "@/services/workspace.api";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (workspace: any) => void;
}

const VISIBILITY_OPTIONS = [
  {
    label: "Private",
    value: "PRIVATE",
    description: "Only invited members can access this workspace.",
    icon: <Lock className="h-4 w-4" />,
  },
  {
    label: "Public",
    value: "PUBLIC",
    description: "Members can discover and join this workspace.",
    icon: <Globe2 className="h-4 w-4" />,
  },
] as const;

export function CreateWorkspaceModal(props: CreateWorkspaceModalProps) {
  const { isOpen, onClose } = props;
  const queryClient = useQueryClient();
  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
      visibility: "PRIVATE",
    },
  });

  const { reset } = form;
  const router = useRouter()
  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(`Workspace "${workspace.name}" created.`);
      if (props.onSuccess) {
        props.onSuccess(workspace);
      } else {
        router.push(`/workspace/${workspace.id}`);
      }
      onClose();
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to create workspace. Please try again.";
      toast.error(errorMsg);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      reset({
        name: "",
        visibility: "PRIVATE",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = (values: WorkspaceFormValues) => {
    createWorkspaceMutation.mutate(values);
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6! shadow-2xl transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close modal"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-white">
              Create Workspace
              <Sparkles className="h-4 w-4 animate-pulse fill-amber-500 text-amber-500" />
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              Set up a space for boards, members, and shared work.
            </p>
          </div>
        </div>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormInput
              name="name"
              label="Workspace Name"
              placeholder="e.g. Product Team"
            />

            <FormRadio
              name="visibility"
              label="Visibility"
              options={VISIBILITY_OPTIONS}
              gridCols="2"
              gap="2.5"
            />

            <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9.5 px-4 text-xs font-semibold border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createWorkspaceMutation.isPending}
                className="h-9.5 px-4 text-xs font-semibold bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700"
              >
                {createWorkspaceMutation.isPending
                  ? "Creating..."
                  : "Create Workspace"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>,
    document.body
  );
}
