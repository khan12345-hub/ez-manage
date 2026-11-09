"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { InboxPage } from "./InboxPage";

export default function WorkInboxRoute() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <InboxPage workspaceId={workspaceId} />
    </Suspense>
  );
}
