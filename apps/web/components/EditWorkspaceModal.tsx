"use client";

import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Globe2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";
import { updateWorkspace } from "@/services/workspace.api";

const schema = z.object({
  name: z.string().trim().min(1, "Workspace name is required"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

type FormValues = z.infer<typeof schema>;

interface EditWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  initialName: string;
  initialVisibility: "PUBLIC" | "PRIVATE";
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

export function EditWorkspaceModal({
  isOpen,
  onClose,
  workspaceId,
  initialName,
  initialVisibility,
}: EditWorkspaceModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialName, visibility: initialVisibility },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ name: initialName, visibility: initialVisibility });
    }
  }, [isOpen, initialName, initialVisibility]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateWorkspace(workspaceId, values),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success(`Workspace "${updated.name}" updated.`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ?? "Failed to update workspace.",
      );
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6! shadow-2xl animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Workspace
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              Update workspace name and visibility.
            </p>
          </div>
        </div>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
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
                className="h-9.5 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={mutation.isPending}
                className="h-9.5 px-4 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
