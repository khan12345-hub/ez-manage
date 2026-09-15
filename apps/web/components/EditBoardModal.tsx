"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, KanbanSquare, Lock, X } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";
import { updateBoard } from "@/services/boards.api";

const schema = z.object({
  name: z.string().trim().min(1, "Board name is required"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

type FormValues = z.infer<typeof schema>;

interface EditBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
  boardId: number;
  initialName: string;
  initialVisibility: "PUBLIC" | "PRIVATE";
  onAfterSuccess?: () => void;
}

const VISIBILITY_OPTIONS = [
  {
    label: "Private",
    value: "PRIVATE",
    description: "Only invited members can access this board.",
    icon: <Lock className="h-4 w-4" />,
  },
  {
    label: "Public",
    value: "PUBLIC",
    description: "All workspace members can view this board.",
    icon: <Globe2 className="h-4 w-4" />,
  },
] as const;

export function EditBoardModal({
  isOpen,
  onClose,
  workspaceId,
  boardId,
  initialName,
  initialVisibility,
  onAfterSuccess,
}: EditBoardModalProps) {
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
    mutationFn: (values: FormValues) => updateBoard(boardId, values),
    onSuccess: (updated: any) => {
      if (workspaceId) queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success(`Board "${updated.name ?? initialName}" updated.`);
      onAfterSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ?? "Failed to update board.",
      );
    },
  });

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
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
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <KanbanSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Board
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              Update board name and visibility.
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
              label="Board Name"
              placeholder="e.g. Sprint Planning"
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
    </div>,
    document.body,
  );
}
