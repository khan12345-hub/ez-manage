"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle2 } from "lucide-react";
import type { CellEditorProps } from "../../EditableCells/EditableCell";

interface CreationLogValue {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  } | null;
  date: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CreationLogCell({ value }: CellEditorProps<CreationLogValue>) {
  const { user, date } = value ?? {};

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground">
        <UserCircle2 className="h-4 w-4 shrink-0 opacity-40" />
        <span className="text-xs opacity-40">—</span>
      </div>
    );
  }

  const avatarUrl = user.avatarUrl
    ? `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user.avatarUrl}`
    : undefined;

  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "");

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 select-none">
      <Avatar className="h-5 w-5 shrink-0">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={fullName} />
        ) : null}
        <AvatarFallback className="text-[10px] font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs font-medium">{fullName}</span>
        {date && (
          <span className="truncate text-[10px] text-muted-foreground">
            {formatDate(date)}
          </span>
        )}
      </div>
    </div>
  );
}
