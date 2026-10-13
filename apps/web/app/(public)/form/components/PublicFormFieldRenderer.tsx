"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, X, Loader2, ChevronDown, Check, UploadCloud } from "lucide-react";
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
  boardId: string | number;
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
    const TEXT_MAX = 255;
    const textLen = String(value ?? "").length;
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <div className="relative">
          <Input
            id={fieldId}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value.slice(0, TEXT_MAX))}
            disabled={disabled}
            placeholder={field.column.name ?? "Enter text"}
            maxLength={TEXT_MAX}
            aria-invalid={Boolean(error)}
            className="h-12 text-base px-4"
          />
          <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground/60">
            {textLen}/{TEXT_MAX}
          </span>
        </div>
      </FormFieldWrapper>
    );
  }

  /* ---------- LONG_TEXT / COMMENT ---------- */
  if (type === "LONG_TEXT" || type === "LONG TEXT" || type === "COMMENT") {
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
          className="min-h-[120px] resize-none text-base px-4 py-3"
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- NUMBER / PRICE ---------- */
  if (type === "NUMBER" || type === "PRICE") {
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
          className="h-12 text-base px-4"
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- DATE / PLAIN_DATE ---------- */
  if (type === "DATE" || type === "PLAIN_DATE") {
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
    if (field.multiSelect) {
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
            value={value as string[] | undefined}
            multiSelect
            onChange={(v) => onChange(v)}
            disabled={disabled}
          />
        </FormFieldWrapper>
      );
    }
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

  /* ---------- EMAIL ---------- */
  if (type === "EMAIL") {
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
          type="email"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="email@example.com"
          aria-invalid={Boolean(error)}
          className="h-12 text-base px-4"
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
          className="h-12 text-base px-4"
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
          value={(value as UploadedFile[] | undefined) ?? []}
          onChange={onChange}
          error={error}
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
  boardId: string | number;
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

/* ---------- FileUploadInput sub-component (multi-file) ---------- */
function FileUploadInput({
  boardId,
  fieldId,
  disabled,
  value,
  onChange,
  error,
}: {
  boardId: string | number;
  fieldId: string;
  disabled: boolean;
  value: UploadedFile[];
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || disabled || uploading) return;
    setUploading(true);
    try {
      const results = await Promise.all(
        list.map((file) => uploadPublicFormFile(boardId, file)),
      );
      const newFiles: UploadedFile[] = results.map((r) => ({
        url: r.url,
        originalName: r.originalName,
        size: r.size,
        storageKey: r.storageKey,
        mimeType: r.mimeType,
      }));
      onChange([...value, ...newFiles]);
    } catch {
      // ignore — user can retry
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
  }

  function handleRemove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length && !disabled && !uploading) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-2">
      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-3 py-2.5"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none">
                  {file.originalName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — always visible so user can keep adding files */}
      <label
        htmlFor={fieldId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          isDragging
            ? "border-primary/60 bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/20",
          error && value.length === 0 && "border-destructive/50",
          (disabled || uploading) && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={fieldId}
          type="file"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={handleFileChange}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground/50" />
        )}
        <div className="text-sm">
          <span className="font-medium text-primary">
            {uploading
              ? "Uploading…"
              : value.length > 0
              ? "Add more files"
              : "Choose files to upload"}
          </span>
          {!uploading && (
            <span className="text-muted-foreground"> or drag and drop here</span>
          )}
        </div>
        {!uploading && (
          <p className="text-xs text-muted-foreground/50">
            Multiple files supported
          </p>
        )}
      </label>
    </div>
  );
}
