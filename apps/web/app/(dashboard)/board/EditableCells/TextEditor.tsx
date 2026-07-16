import { Input } from "@/components/ui/input";

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  save: () => void;
  cancel: () => void;
}

export function TextEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: Props) {
  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={()=>save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      }}
      className="h-full w-40 text-[16px]! rounded-none border-none shadow-none focus-visible:ring-0"
    />
  );
}