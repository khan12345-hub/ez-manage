"use client";

import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";

export function GuestHeader() {
  const { user } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="grid h-7 w-7 grid-cols-2 gap-[3px] rotate-45">
            <div className="rounded-[2px] bg-[#FF3D57]" />
            <div className="rounded-[2px] bg-[#00CFF4]" />
            <div className="rounded-[2px] bg-[#FFCB00]" />
            <div className="rounded-[2px] bg-[#00C875]" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">EzManage</span>
        </Link>

        {user && (
          <div className="flex items-center gap-2.5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
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
