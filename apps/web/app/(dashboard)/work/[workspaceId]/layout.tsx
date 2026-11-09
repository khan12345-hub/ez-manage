"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workApi } from "@/services/work.api";
import { NoWorkAccess } from "../_components/NoWorkAccess";

/** Every Work page checks Work access first (Boards membership is not enough). */
export default function WorkWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  if (isLoading) return <div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>;
  const ok = data?.some((w) => w.uid === workspaceId || String(w.id) === workspaceId);
  if (!ok) return <NoWorkAccess />;
  return <>{children}</>;
}
