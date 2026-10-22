"use client";

import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { resolveUrl } from "@/lib/resolveUrl";

export function GuestHeader() {
  const { user } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]"
            style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)" }}
          >
            <svg width="15" height="12" viewBox="0 0 20 16" fill="none" aria-hidden="true">
              <rect x="0" y="0"   width="18" height="2.5" rx="1.25" fill="white" fillOpacity="0.92" />
              <rect x="0" y="6.5" width="13" height="2.5" rx="1.25" fill="white" fillOpacity="0.70" />
              <rect x="0" y="13"  width="8"  height="2.5" rx="1.25" fill="white" fillOpacity="0.48" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">EzManage</span>
        </Link>

        {user && (
          <div className="flex items-center gap-2.5">
            {user.avatarUrl ? (
              <img
                src={resolveUrl(user.avatarUrl) || undefined}
                alt={`${user.firstName} ${user.lastName}`}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
            )}
            <span className="text-sm font-medium text-foreground">
              {user.firstName} {user.lastName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
