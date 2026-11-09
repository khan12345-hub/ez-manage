"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { useInboxCounts } from "@/app/(dashboard)/work/[workspaceId]/inbox/useInboxCounts";

/** Work header bell: Work notifications only, opens the Work Inbox. */
export function WorkInboxBell() {
  const params = useParams<{ workspaceId?: string }>();
  const ws = String(params.workspaceId ?? "");
  const n = useInboxCounts().primaryUnread;
  return (
    <Link
      href={ws ? `/work/${ws}/inbox` : "/work"}
      aria-label={n ? `Work inbox, ${n} unread` : "Work inbox"}
      title="Work inbox"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Inbox className="h-[18px] w-[18px]" />
      {n > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-primary px-1 text-center font-mono text-[10px] leading-[17px] text-primary-foreground">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
