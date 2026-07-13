import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "./field";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Primitive = string | number;

interface AppSelectProps<T> {
  label?: string;
  options: T[];
  value?: Primitive;
  onChange: (value: Primitive, option: T) => void;

  valueField: keyof T;
  labelField: keyof T;

  placeholder?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  wrapperClassName?: string;
}

export function AppSelect<T extends Record<string, any>>({
  label,
  options,
  value,
  onChange,
  valueField,
  labelField,
  placeholder = "Select...",
  disabled,
  className,
  wrapperClassName,
  labelClassName,
}: AppSelectProps<T>) {
  const handleValueChange = (selectedValue: string) => {
    const option = options.find(
      (item) => String(item[valueField]) === selectedValue,
    );
    
    

    if (!option) return;

    onChange(option[valueField] as Primitive, option);
  };

  return (
    <Field className={wrapperClassName}>
      {label && <FieldLabel className={labelClassName}>{label}</FieldLabel>}
      <Select
        value={value ? String(value) : undefined}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={String(option[valueField])}
              value={String(option[valueField])}
            >
              {String(option[labelField])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
