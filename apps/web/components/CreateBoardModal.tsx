"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Kanban,
  Globe2,
  Lock,
  Sparkles,
  X,
} from "lucide-react";

import { toast } from "sonner";
import * as z from "zod";
import { useRouter } from "next/navigation";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";

import {
  createBoard,
  importExcelBoard,
  ImportExcelBoardDto,
} from "@/services/boards.api";

import { useImportJobs } from "@/providers/ImportJobContext";

import { ExcelImportModal } from "@/app/(dashboard)/workspace/[workspaceId]/board/ImportBoard/ExcelImportModal";

import {
  useBoardTemplates,
} from "@/app/(dashboard)/system-settings/board-template/useBoardTemplate";
import { BoardTemplateSelector } from "./BoardTemplateSelector";

// import { BoardTemplateSelector } from "@/app/(dashboard)/system-settings/board-template/BoardTemplateSelector";

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
  const router = useRouter();
  const { startJob } = useImportJobs();

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardSchema),
    defaultValues: {
      name: "",
      visibility: "PRIVATE",
    },
  });

  const { reset, setValue } = form;

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  // Template state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(null);

  const {
    data: templates = [],
    isLoading: templatesLoading,
  } = useBoardTemplates();

  const selectedTemplate = templates.find(
    (template: any) => template.id === templateId,
  );

  /*
   * Normal board creation.
   */
  const createBoardMutation = useMutation({
    mutationFn: (values: BoardFormValues) =>
      createBoard({
        ...values,
        workspaceId,
        ...(templateId !== null
          ? {
              templateId,
            }
          : {}),
      }),

    onSuccess: (board) => {
      queryClient.invalidateQueries({
        queryKey: ["boards", workspaceId],
      });

      toast.success(`Board "${board.name}" created.`);

      router.push(
        `/workspace/${workspaceId}/board/${board.id}`,
      );

      onClose();
    },

    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to create board. Please try again.";

      toast.error(
        Array.isArray(errorMsg)
          ? errorMsg.join(", ")
          : errorMsg,
      );
    },
  });

  /*
   * Excel board import.
   */
  const importExcelMutation = useMutation({
    mutationFn: (dto: ImportExcelBoardDto) => importExcelBoard(dto),

    onSuccess: (result, variables) => {
      setExcelModalOpen(false);
      setExcelFile(null);
      onClose();
      startJob(result.jobId, variables.boardName, workspaceId);
    },

    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to start import. Please try again.";

      toast.error(
        Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg,
      );
    },
  });

  useEffect(() => {
    if (!isOpen) {
      reset({
        name: "",
        visibility: "PRIVATE",
      });

      setExcelFile(null);
      setExcelModalOpen(false);
      setShowTemplates(false);
      setTemplateId(null);
    }
  }, [isOpen, reset]);

  /*
   * Called by ExcelImportModal when
   * the user selects a file.
   */
  const handleExcelFileChange = (
    file: File | null,
  ) => {
    setExcelFile(file);
  };

  /*
   * Final Excel import.
   */
  const handleExcelImport = (
    dto: Omit<ImportExcelBoardDto, "workspaceId">,
  ) => {
    importExcelMutation.mutate({
      ...dto,
      workspaceId,
    });
  };

  const handleOpenExcelImport = () => {
    setExcelModalOpen(true);
  };

  /*
   * Normal board submit.
   *
   * Template ID is automatically included
   * if a template has been selected.
   */
  const onSubmit = (values: BoardFormValues) => {
    createBoardMutation.mutate(values);
  };

  /*
   * Template selection.
   */
  const handleTemplateContinue = () => {
    if (templateId === null) {
      toast.error("Please select a template.");
      return;
    }

    setShowTemplates(false);
  };

  /*
   * Remove currently selected template.
   */
  const handleClearTemplate = () => {
    setTemplateId(null);
  };

  const isSubmitting =
    createBoardMutation.isPending ||
    importExcelMutation.isPending;

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6! shadow-2xl transition-all animate-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950"
          role="dialog"
          aria-modal="true"
        >
          {/* Top accent */}
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600" />

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          {/* Header */}
          <div className="mb-6 flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <Kanban className="h-5 w-5" />
            </div>

            <div>
              <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-white">
                {showTemplates
                  ? "Choose Template"
                  : "Create Board"}

                <Sparkles className="h-4 w-4 animate-pulse fill-amber-500 text-amber-500" />
              </h2>

              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                {showTemplates
                  ? "Start your board with a predefined structure."
                  : "Add a new board to organize tasks and collaborate with your team."}
              </p>
            </div>
          </div>

          {!showTemplates ? (
            <>
              {/* Selected template */}
              {selectedTemplate && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 dark:border-cyan-900 dark:bg-cyan-950/30">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                      Using template
                    </p>

                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedTemplate.name}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTemplateId(null);
                      setShowTemplates(true);
                    }}
                    disabled={isSubmitting}
                    className="shrink-0 text-xs font-medium text-cyan-600 hover:underline disabled:pointer-events-none disabled:opacity-50 dark:text-cyan-400"
                  >
                    Change
                  </button>
                </div>
              )}

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

                  {/* Excel Import */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Import from Excel
                    </p>

                    <button
                      type="button"
                      onClick={handleOpenExcelImport}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center rounded-lg border border-dashed p-5 text-sm transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {excelFile ? (
                        <span
                          className="min-w-0 max-w-full truncate px-2"
                          title={excelFile.name}
                        >
                          {excelFile.name}
                        </span>
                      ) : (
                        <span>Select Excel file</span>
                      )}
                    </button>
                  </div>

                  {/* Template */}
                  {!selectedTemplate && !excelFile && (
                    <div className="border-t border-gray-100 pt-4 dark:border-zinc-800">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() =>
                          setShowTemplates(true)
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-300 px-4 py-2.5 text-sm font-medium text-cyan-600 transition-colors hover:bg-cyan-50 disabled:pointer-events-none disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                      >
                        <Kanban className="h-4 w-4" />
                        Use template
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-zinc-800">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="h-9.5 border-gray-200 px-4 text-xs font-semibold hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      Cancel
                    </Button>

                    <Button
                      type="submit"
                      loading={createBoardMutation.isPending}
                      disabled={importExcelMutation.isPending}
                      className="h-9.5 bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-cyan-700"
                    >
                      {createBoardMutation.isPending
                        ? "Creating..."
                        : "Create Board"}
                    </Button>
                  </div>
                </form>
              </FormProvider>
            </>
          ) : (
            /* Template selector */
            <div>
              <BoardTemplateSelector
                templates={templates}
                selectedTemplateId={templateId}
                onSelect={setTemplateId}
                isLoading={templatesLoading}
              />

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplates(false);
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Back
                </button>

                <Button
                  type="button"
                  onClick={handleTemplateContinue}
                  disabled={
                    isSubmitting ||
                    templateId === null
                  }
                  className="bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Excel import modal */}
      <ExcelImportModal
        open={excelModalOpen}
        onOpenChange={setExcelModalOpen}
        file={excelFile}
        onFileChange={handleExcelFileChange}
        onImport={handleExcelImport}
        defaultBoardName={form.getValues("name")}
        defaultVisibility={form.getValues("visibility")}
        isImporting={importExcelMutation.isPending}
      />

    </>,
    document.body
  );
}



