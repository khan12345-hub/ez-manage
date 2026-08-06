import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

interface Props {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string | { text: string };
  setValue: React.Dispatch<React.SetStateAction<string | { text: string }>>;
  save: (value?: string) => void;
  cancel: () => void;
  isPrimary?: boolean;
}

export function TextEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
  isPrimary,
}: Props) {
  const [open, setOpen] = useState(false);

  const textValue = typeof value === "string" ? value : value.text;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setValue(e.target.value);
  };

  const handleSave = () => {
    setOpen(false);
    save(textValue);
  };

  const handleCancel = () => {
    setOpen(false);
    cancel();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (isPrimary && e.key === "Enter") {
      e.preventDefault();
      handleSave();
      return;
    }

    if (!isPrimary && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  // Primary column
  if (isPrimary) {
    return (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={textValue}
        onChange={handleChange}
        onBlur={() => save(textValue)}
        onKeyDown={handleKeyDown}
        className="h-full w-full truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
        
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={textValue}
          onChange={handleChange}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-full w-full truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
        />
      </PopoverAnchor>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-[400px] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={textValue}
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
    </Popover>
  );
}