import { Input } from "@/components/ui/input";

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string | { text: string };
  setValue: React.Dispatch<React.SetStateAction<string | { text: string }>>;
  save: () => void;
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

  console.log("first", isPrimary)
  return (
    <Input
      ref={inputRef}
      value={typeof value === "string" ? value : value.text}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onBlur={() => save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      }}
      className="h-full w-full truncate text-[16px]! rounded-none border-none shadow-none focus-visible:ring-0"
    />
  );
}
