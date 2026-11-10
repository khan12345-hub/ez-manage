"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workApi } from "@/services/work.api";

/** /work → the first workspace where this person has Work access. */
export default function WorkIndexPage() {
  const router = useRouter();
  const { data: workspaces, isLoading } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  const first = workspaces?.[0];
  useEffect(() => {
    if (first) router.replace(`/work/${first.uid}`);
    else if (!isLoading && workspaces) router.replace("/work/create");
  }, [first, isLoading, workspaces, router]);
  return <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">Opening Work…</div>;
}
