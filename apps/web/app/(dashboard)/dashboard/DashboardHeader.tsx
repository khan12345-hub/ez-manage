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

    
    </div>
  );
}