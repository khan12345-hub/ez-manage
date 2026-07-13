import { Controller, useFormContext } from "react-hook-form";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "../ui/input";
import { TextFieldTypes } from "./fields.types";

export function FormInput({
  name,
  label,
  // description,
  ...inputProps
}: TextFieldTypes) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          {label && <FieldLabel htmlFor={name}>{label}</FieldLabel>}

          <Input
            id={name}
            {...field}
            {...inputProps}
            aria-invalid={!!fieldState.error}
          />

          {/* {description && (
            <FieldDescription>{description}</FieldDescription>
          )} */}

          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}