"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { workApi } from "@/services/work.api";

/** Work header bell: Work notifications only, opens the Work Inbox. */
export function WorkInboxBell() {
  const params = useParams<{ workspaceId?: string }>();
  const ws = String(params.workspaceId ?? "");
  const { data } = useQuery({
    queryKey: ["inbox", "primary", true, "work"],
    queryFn: () => workApi.inbox("primary", { unread: true }),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
  const n = data?.counts.primaryUnread ?? 0;
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
