// components/ui/user-avatar.tsx

"use client";

import { resolveUrl } from "@/lib/resolveUrl";

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
}

export function FileUploaderAvatar({
  name,
  avatarUrl,
}: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={resolveUrl(avatarUrl)}
        alt={name ?? "User"}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name?.charAt(0)?.toUpperCase() ?? "U"}
    </div>
  );
}