"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";

/** /work → the first workspace's Work home. */
export default function WorkIndexPage() {
  const router = useRouter();
  const { data: workspaces, isLoading } = useQuery({ queryKey: ["workspaces"], queryFn: getAllWorkspaces, staleTime: 60_000 });
  const first = (workspaces as any[] | undefined)?.[0];
  useEffect(() => {
    if (first) router.replace(`/work/${first.uid ?? first.id}`);
  }, [first, router]);
  return (
    <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
      {isLoading || first ? "Opening Work…" : "You're not in a workspace yet. Ask an admin to invite you."}
    </div>
  );
}
