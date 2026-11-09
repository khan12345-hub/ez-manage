"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { workApi } from "@/services/work.api";
import { groupRows, kindOf, loadSettings, type InboxNotification } from "./inboxModel";

/** Primary unread count (same rules as the Inbox page) for the sidebar badge and header bell. */
export function useInboxCounts() {
  const { data } = useQuery({ queryKey: ["work-inbox", "active"], queryFn: () => workApi.workInbox("active"), refetchInterval: 60_000, staleTime: 20_000 });
  return useMemo(() => {
    const important = new Set(loadSettings().important);
    const items = (data?.items ?? []) as InboxNotification[];
    const primary = items.filter((n) => important.has(kindOf(n)));
    return { primaryUnread: groupRows(primary, true).filter((r) => r.unread).length };
  }, [data]);
}
