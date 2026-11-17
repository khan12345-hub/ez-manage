"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** People live in Teams › All People (same screen, list view with roles). */
export default function WorkPeopleRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/work/${workspaceId}/teams?tab=people&view=list`); }, [router, workspaceId]);
  return <div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>;
}
