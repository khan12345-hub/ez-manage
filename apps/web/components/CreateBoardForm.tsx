"use client";

import {
  FormProvider,
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import * as z from "zod";

import { FormInput } from "./form/FormInput";
import { FormRadio } from "./form/FormRadio";
import { Button } from "./ui/button";

const boardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      "Board name is required",
    ),

  visibility: z.enum([
    "PUBLIC",
    "PRIVATE",
  ]),
});

type BoardFormValues =
  z.infer<
    typeof boardSchema
  >;

interface CreateBoardFormProps {
  isSubmitting: boolean;

  onSubmit: (
    values: BoardFormValues,
  ) => void;

  onFileChange: (
    file: File | null,
  ) => void;

  onClose: () => void;
  onExcelImport: () => void;
}

const VISIBILITY_OPTIONS = [
  {
    label: "Private",
    value: "PRIVATE",
    description:
      "Only invited members can access this board.",
    icon: (
      <span className="text-sm">
        🔒
      </span>
    ),
  },

  {
    label: "Public",
    value: "PUBLIC",
    description:
      "Members can discover and join this board.",
    icon: (
      <span className="text-sm">
        🌐
      </span>
    ),
  },
] as const;

export function CreateBoardForm({
  isSubmitting,
  onSubmit,
  onFileChange,
  onClose,
}: CreateBoardFormProps) {
  const form =
    useForm<BoardFormValues>({
      resolver:
        zodResolver(
          boardSchema,
        ),

      defaultValues: {
        name: "",
        visibility:
          "PRIVATE",
      },
    });

  const handleExcelChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      onFileChange(null);

      return;
    }

    const fileName =
      file.name.toLowerCase();

    const isExcel =
      fileName.endsWith(
        ".xlsx",
      ) ||
      fileName.endsWith(
        ".xls",
      );

    if (!isExcel) {
      event.target.value = "";

      onFileChange(null);

      return;
    }

    onFileChange(file);
    console.log(file)
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(
          onSubmit,
        )}
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
          options={
            VISIBILITY_OPTIONS
          }
          gridCols="2"
          gap="2.5"
        />

        {/* <div className="space-y-2">
          <label
            htmlFor="excel-file"
            className="text-sm font-medium"
          >
            Import from Excel
          </label>

          <input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={
              handleExcelChange
            }
            className="block w-full cursor-pointer rounded-lg border border-dashed p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />

          <p className="text-xs text-muted-foreground">
            Optional. Upload an Excel file to create the board from your existing data.
          </p>
        </div> */}

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
            loading={isSubmitting}
            className="h-9.5 bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-cyan-700"
          >
            {isSubmitting
              ? "Creating..."
              : "Create Board"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

