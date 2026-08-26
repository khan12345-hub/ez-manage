"use client";

import { memo, useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CellEditorProps } from "./EditableCell";

interface Props extends CellEditorProps<string> {
  isPrimary?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Cheap non-editing display                                                  */
/* -------------------------------------------------------------------------- */

const TextValue = memo(function TextValue({
  value,
  onClick,
}: {
  value?: string | null;
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      title={value || ""}
      className="block h-full w-full cursor-text truncate"
    >
      {value || ""}
    </span>
  );
});

/* -------------------------------------------------------------------------- */
/* Primary editor                                                             */
/* -------------------------------------------------------------------------- */

const PrimaryEditor = memo(function PrimaryEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: Props) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    },
    [setValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={value ?? ""}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            // onBlur={save}
            className="h-full w-full truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
          />
        </TooltipTrigger>

        {value && (
          <TooltipContent
            side="top"
            align="start"
            className="max-w-md whitespace-pre-wrap wrap-break-word"
          >
            {value}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
});

/* -------------------------------------------------------------------------- */
/* Non-primary editor                                                         */
/* -------------------------------------------------------------------------- */

const NonPrimaryEditor = memo(function NonPrimaryEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: Props) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [setValue],
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (
        e.key === "Enter" &&
        (e.ctrlKey || e.metaKey)
      ) {
        e.preventDefault();
        save();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  return (
    <Popover open>
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverAnchor asChild>
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={value ?? ""}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className="h-full w-full truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
              />
            </PopoverAnchor>
          </TooltipTrigger>

          {value && (
            <TooltipContent
              side="top"
              align="start"
              className="max-w-md whitespace-pre-wrap wrap-break-word"
            >
              {value}
            </TooltipContent>
          )}
        </Tooltip>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-[400px] p-0"
        >
          <Textarea
            value={value ?? ""}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Write something..."
            rows={6}
            autoFocus
            className="min-h-[140px] w-full resize-y rounded-md border-none px-3 py-3 text-[16px]! leading-6 shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>Esc to cancel</span>

            <span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
                Enter
              </kbd>{" "}
              to save
            </span>
          </div>
        </PopoverContent>
      </TooltipProvider>
    </Popover>
  );
});

/* -------------------------------------------------------------------------- */
/* Main editor                                                                */
/* -------------------------------------------------------------------------- */

export function TextEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
  editing,
  isPrimary,
}: Props) {
  /*
   * IMPORTANT:
   *
   * `editing` is controlled by EditableCell.
   *
   * When false, we render ONLY the cheap display value.
   * When true, we mount the actual editor.
   */

  if (!editing) {
    return <TextValue value={value} />;
  }

  if (isPrimary) {
    return (
      <PrimaryEditor
        inputRef={inputRef}
        value={value}
        setValue={setValue}
        save={save}
        cancel={cancel}
        editing={editing}
        isPrimary
      />
    );
  }

  return (
    <NonPrimaryEditor
      inputRef={inputRef}
      value={value}
      setValue={setValue}
      save={save}
      cancel={cancel}
      editing={editing}
      isPrimary={false}
    />
  );
}