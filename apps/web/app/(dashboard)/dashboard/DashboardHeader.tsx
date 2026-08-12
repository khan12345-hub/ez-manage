"use client";

import { Bell, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";

export function DashboardHeader() {
  const { user } = useAuth();

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "User";

  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((name) => name?.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">
          Your workspace overview
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Good afternoon, {user?.firstName || "there"}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspaces.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          aria-label="Search"
        >
          <Search className="size-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
        </Button>

        <Button className="gap-2 rounded-xl">
          <Plus className="size-4" />
          Create
        </Button>

        <div className="ml-2 flex items-center gap-3">
          <Avatar className="size-9">
            {user?.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={fullName} />
            )}

            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="hidden min-w-0 lg:block">
            <p className="max-w-[160px] truncate text-sm font-medium">
              {fullName}
            </p>

            <p className="max-w-[160px] truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}