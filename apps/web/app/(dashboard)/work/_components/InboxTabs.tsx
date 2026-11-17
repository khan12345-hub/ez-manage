"use client";

/* One Inbox (Slack "Activity" style): All · Replies · Assigned comments · Posts · Search chat. */

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { AtSign, CheckCheck, Inbox, Megaphone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInboxCounts } from "../[workspaceId]/inbox/useInboxCounts";

const TABS = [
  { path: "inbox", label: "All activity", icon: Inbox },
  { path: "replies", label: "Replies", icon: AtSign },
  { path: "assigned-comments", label: "Assigned comments", icon: CheckCheck },
  { path: "chat/posts", label: "Posts", icon: Megaphone },
  { path: "chat/search", label: "Search chat", icon: Search },
] as const;
export const INBOX_TAB_PATHS: string[] = TABS.map((t) => t.path);

export function InboxTabs() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const inbox = useInboxCounts();
  return (
    <div className="sticky top-0 z-20 bg-[#f2f4f3]/90 px-4 pb-2 pt-4 backdrop-blur sm:px-6 dark:bg-background/90">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Inbox</h1>
        {inbox.primaryUnread > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-semibold text-primary">{inbox.primaryUnread} new</span>}
      </div>
      <nav aria-label="Inbox" className="mt-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const on = pathname === `/work/${workspaceId}/${t.path}`;
          return (
            <Link key={t.path} href={`/work/${workspaceId}/${t.path}`} aria-current={on ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", on ? "bg-forest text-white shadow-sm dark:bg-primary dark:text-primary-foreground" : "bg-white text-foreground/70 ring-1 ring-black/[0.06] hover:text-foreground dark:bg-white/5 dark:ring-white/10")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
