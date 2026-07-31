"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Kanban, Globe2, Lock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";
import { createBoard } from "@/services/boards.api";
import { useRouter } from "next/navigation";
import { ExcelBoardImport } from "./ExcelBoardImport";

const boardSchema = z.object({
  name: z.string().trim().min(1, "Board name is required"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

type BoardFormValues = z.infer<typeof boardSchema>;

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
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
    description: "Members can discover and join this board.",
    icon: <Globe2 className="h-4 w-4" />,
  },
] as const;

export function CreateBoardModal({
  isOpen,
  onClose,
  workspaceId,
}: CreateBoardModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardSchema),
    defaultValues: {
      name: "",
      visibility: "PRIVATE",
    },
  });

  const { reset } = form;

  const [excelFile, setExcelFile] = useState<File | null>(null);

  const [excelPreviewOpen, setExcelPreviewOpen] = useState(false);

  const router = useRouter();
  const createBoardMutation = useMutation({
    mutationFn: (values: BoardFormValues) =>
      createBoard({
        ...values,
        workspaceId,
      }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] });
      toast.success(`Board "${board.name}" created.`);
      router.push(`/workspace/${workspaceId}/board/${board.id}`);
      onClose();
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to create board. Please try again.";
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

  const onSubmit = (values: BoardFormValues) => {
    createBoardMutation.mutate(values);
  };

  if (!isOpen) return null;

  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6! shadow-2xl transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close modal"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
            <Kanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-white">
              Create Board
              <Sparkles className="h-4 w-4 animate-pulse fill-amber-500 text-amber-500" />
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              Add a new board to organize tasks and collaborate with your team.
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
              label="Board Name"
              placeholder="e.g. Q4 Features"
            />

            <FormRadio
              name="visibility"
              label="Visibility"
              options={VISIBILITY_OPTIONS}
              gridCols="2"
              gap="2.5"
            />

            <ExcelBoardImport
              file={excelFile}
              onFileChange={setExcelFile}
              onPreview={() => setExcelPreviewOpen(true)}
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
                loading={createBoardMutation.isPending}
                className="h-9.5 px-4 text-xs font-semibold bg-cyan-600 text-white shadow-sm transition-all hover:bg-cyan-700"
              >
                {createBoardMutation.isPending ? "Creating..." : "Create Board"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
