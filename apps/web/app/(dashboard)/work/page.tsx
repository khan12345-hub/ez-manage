"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workApi } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";

/** /work → the first workspace where this person has Work access. */
export default function WorkIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: workspaces, isLoading } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  const first = workspaces?.[0];
  useEffect(() => {
    if (first) router.replace(`/work/${first.uid}`);
    // no Work access: only the super admin starts one from here; everyone else goes back to their products
    else if (!isLoading && workspaces && user) router.replace(user.systemRole === "SUPER_ADMIN" ? "/work/create" : "/home");
  }, [first, isLoading, workspaces, router, user]);
  return <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">Opening Work…</div>;
}
