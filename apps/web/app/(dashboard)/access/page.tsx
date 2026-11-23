"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { accessApi } from "@/services/access.api";
import { AccessCenter } from "./_components/AccessCenter";

/** Access Center: Administrators, and Access Managers for their companies */
export default function AccessPage() {
  const { user } = useAuth();
  const { data: me, isLoading } = useQuery({ queryKey: ["access", "me"], queryFn: accessApi.me, enabled: !!user });
  if (!user || isLoading) return <div className="m-6 h-64 animate-pulse rounded-3xl bg-muted" />;
  if (!me?.canManage) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <ShieldCheck className="h-8 w-8 text-[#b08d57]" />
        <h1 className="mt-3 text-[24px] font-semibold">Access Center</h1>
        <p className="mt-1 max-w-[420px] text-[13.5px] text-muted-foreground">Only the Administrator and Access Managers can open this.</p>
        <Link href="/home" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    );
  }
  return <AccessCenter me={me} />;
}
