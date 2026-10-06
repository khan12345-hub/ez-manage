"use client";

import { useAuth } from "@/providers/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Sparkles } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";

export function DashboardHeader() {
  const { user } = useAuth();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n?.charAt(0).toUpperCase())
    .join("") || "U";

  const avatarUrl = user?.avatarUrl
    ? user.avatarUrl.startsWith("http")
      ? user.avatarUrl
      : `${BASE_URL}${user.avatarUrl}`
    : null;

  const workspaceCount = user?.workspaceMemberships?.length ?? 0;
  const boardCount = user?.boardMemberships?.length ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 shadow-lg">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 right-24 h-32 w-32 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-72 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left — greeting */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 ring-2 ring-white/30">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback className="bg-white/20 text-lg font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              {getGreeting()}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-white">{fullName}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-indigo-200">
              <CalendarDays className="h-3.5 w-3.5" />
              {getFormattedDate()}
            </p>
          </div>
        </div>

        {/* Right — summary pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <span className="text-sm font-bold text-white">{user ? workspaceCount : "—"}</span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-indigo-200">Workspaces</p>
              <p className="text-xs font-semibold text-white">Active</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <span className="text-sm font-bold text-white">{user ? boardCount : "—"}</span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-indigo-200">Boards</p>
              <p className="text-xs font-semibold text-white">Joined</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
