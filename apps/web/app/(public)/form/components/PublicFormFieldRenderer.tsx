"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, X, Loader2, ChevronDown, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  PublicBoardFormField,
  uploadPublicFormFile,
  getPublicFormMembers,
  type PublicFormMember,
} from "@/services/board-form.api";
import { getMe } from "@/services/auth/auth.api";

import { FormFieldWrapper } from "./FormFieldWrapper";
import { FormDatePicker } from "./FormDatePicker";
import { FormTimelinePicker } from "./FormTimelinePicker";
import { FormStatusPicker } from "./FormStatusPicker";

interface TimelineValue {
  startDate?: string;
  endDate?: string;
}

interface UploadedFile {
  url: string;
  originalName: string;
  size: number;
  storageKey?: string;
  mimeType?: string;
}

interface PublicFormFieldRendererProps {
  field: PublicBoardFormField;
  boardId: number;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export function PublicFormFieldRenderer({
  field,
  boardId,
  value,
  error,
  disabled = false,
  onChange,
}: PublicFormFieldRendererProps) {
  const type = field.column.type.toUpperCase();
  const fieldId = `field-${field.id}`;
  const label = field.label ?? field.column.name;

  /* ---------- CHECKBOX (inline layout) ---------- */
  if (type === "CHECKBOX") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
        inline
      >
        <Checkbox
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
          className="mt-0.5"
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- TEXT ---------- */
  if (type === "TEXT") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Input
          id={fieldId}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.column.name ?? "Enter text"}
          aria-invalid={Boolean(error)}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- LONG_TEXT ---------- */
  if (type === "LONG_TEXT" || type === "LONG TEXT") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Textarea
          id={fieldId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.column.name ?? "Enter text"}
          aria-invalid={Boolean(error)}
          className="min-h-[90px] resize-none"
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- NUMBER ---------- */
  if (type === "NUMBER") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Input
          id={fieldId}
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          disabled={disabled}
          placeholder="Enter number"
          aria-invalid={Boolean(error)}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- DATE ---------- */
  if (type === "DATE") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormDatePicker
          id={fieldId}
          value={String(value ?? "")}
          onChange={(iso) => onChange(iso)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- TIMELINE ---------- */
  if (type === "TIMELINE") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormTimelinePicker
          value={value as TimelineValue | undefined}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- STATUS / DROPDOWN / LABEL ---------- */
  if (type === "STATUS" || type === "DROPDOWN" || type === "LABEL") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormStatusPicker
          id={fieldId}
          options={field.column.statusOptions ?? []}
          value={value as string | undefined}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- LINK ---------- */
  if (type === "LINK") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Input
          id={fieldId}
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="https://"
          aria-invalid={Boolean(error)}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- FILE ---------- */
  if (type === "FILE") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FileUploadInput
          boardId={boardId}
          fieldId={fieldId}
          disabled={disabled}
          value={value as UploadedFile | undefined}
          onChange={onChange}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- PERSON — member picker ---------- */
  if (type === "PERSON") {
    return (
      <PersonField
        fieldId={fieldId}
        boardId={boardId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
    );
  }

  /* ---------- Unsupported types (FILE_FEEDBACK, CREATION_LOG) ---------- */
  if (["FILE_FEEDBACK", "CREATION_LOG"].includes(type)) {
    return null; // silently skip — these are internal system columns
  }

  /* ---------- Unknown / fallback ---------- */
  return (
    <FormFieldWrapper
      id={fieldId}
      label={label}
      description={field.description}
      required={field.required}
      error={error}
    >
      <Input
        id={fieldId}
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
    </FormFieldWrapper>
  );
}

/* ---------- PersonField — board member picker ---------- */
function PersonField({
  fieldId,
  boardId,
  label,
  description,
  required,
  error,
  disabled,
  value,
  onChange,
}: {
  fieldId: string;
  boardId: number;
  label: string;
  description?: string | null;
  required: boolean;
  error?: string;
  disabled: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);

  /* Fetch board members (public endpoint, no auth needed) */
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["public-form-members", boardId],
    queryFn: () => getPublicFormMembers(boardId),
    staleTime: 60_000,
  });

  /* Fetch logged-in user to pre-select */
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });

  /* Auto-select logged-in user if they're a board member */
  useEffect(() => {
    if (me && !value && members.length > 0) {
      const found = members.find((m) => m.email === me.email);
      if (found) onChange({ userId: found.id });
    }
  }, [me, members]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = members.find(
    (m) => m.id === (value as any)?.userId,
  );

  return (
    <FormFieldWrapper
      id={fieldId}
      label={label}
      description={description}
      required={required}
      error={error}
    >
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          id={fieldId}
          disabled={disabled || isLoading}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/60",
            open && "border-primary ring-1 ring-primary/30",
            error && "border-destructive",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selected ? (
            <MemberBadge member={selected} />
          ) : (
            <span className="text-muted-foreground">Select a person…</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {/* Backdrop to close on outside click */}
        {open && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
            {members.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No members found
              </div>
            ) : (
              <ul className="max-h-52 overflow-y-auto py-1">
                {members.map((member) => {
                  const isSelected = selected?.id === member.id;
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted",
                          isSelected && "bg-primary/10 font-medium text-primary",
                        )}
                        onClick={() => {
                          onChange({ userId: member.id });
                          setOpen(false);
                        }}
                      >
                        <MemberBadge member={member} />
                        {isSelected && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </FormFieldWrapper>
  );
}

/* Small avatar + name for a board member */
function MemberBadge({ member }: { member: PublicFormMember }) {
  const initials = `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <>
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt={`${member.firstName} ${member.lastName}`}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {initials}
        </div>
      )}
      <span className="truncate">
        {member.firstName} {member.lastName}
      </span>
    </>
  );
}

/* ---------- FileUploadInput sub-component ---------- */
function FileUploadInput({
  boardId,
  fieldId,
  disabled,
  value,
  onChange,
}: {
  boardId: number;
  fieldId: string;
  disabled: boolean;
  value: UploadedFile | undefined;
  onChange: (value: unknown) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadPublicFormFile(boardId, file);
      onChange({
        url: result.url,
        originalName: result.originalName,
        size: result.size,
        storageKey: result.storageKey,
        mimeType: result.mimeType,
      });
    } catch {
      // ignore — user can retry
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{value.originalName}</span>
        {!disabled && (
          <button type="button" onClick={handleRemove} className="shrink-0 text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {uploading ? "Uploading…" : "Choose file"}
      </Button>
    </>
  );
}
