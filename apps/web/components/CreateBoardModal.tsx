"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Kanban, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { createBoard, importBoard } from "@/services/boards.api";
import { CreateBoardForm } from "./CreateBoardForm";

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
}

export function CreateBoardModal({
  isOpen,
  onClose,
  workspaceId,
}: CreateBoardModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [excelFile, setExcelFile] = useState<File | null>(null);

  const createBoardMutation = useMutation({
    mutationFn: (values: { name: string; visibility: "PUBLIC" | "PRIVATE" }) =>
      createBoard({
        ...values,
        workspaceId,
      }),

    onSuccess: (board) => {
      queryClient.invalidateQueries({
        queryKey: ["boards", workspaceId],
      });

      toast.success(`Board "${board.name}" created.`);

      router.push(`/workspace/${workspaceId}/board/${board.id}`);

      onClose();
    },

    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        "Failed to create board. Please try again.";

      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const importBoardMutation = useMutation({
    mutationFn: (values: {
      name: string;
      visibility: "PUBLIC" | "PRIVATE";
      file: File;
    }) => importBoard({...values, workspaceId}),

    onSuccess: (board) => {
      queryClient.invalidateQueries({
        queryKey: ["boards", workspaceId],
      });

      // toast.success(`Board "${board.name}" imported successfully.`);

      // router.push(`/workspace/${workspaceId}/board/${board.id}`);

      onClose();
    },

    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        "Failed to import board. Please try again.";

      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setExcelFile(null);
    }
  }, [isOpen]);

  const handleSubmit = (values: {
    name: string;
    visibility: "PUBLIC" | "PRIVATE";
  }) => {
    console.log(values);
    if (excelFile) {
      importBoardMutation.mutate({
        ...values,
        file: excelFile,
      });

      return;
    }

    createBoardMutation.mutate(values);
  };

  const isSubmitting =
    createBoardMutation.isPending || importBoardMutation.isPending;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6! shadow-2xl transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600" />

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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

        <CreateBoardForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onFileChange={setExcelFile}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
