// components/ui/user-avatar.tsx

"use client";

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
        src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL+avatarUrl}
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