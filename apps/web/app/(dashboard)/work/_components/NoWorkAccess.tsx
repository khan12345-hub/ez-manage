"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown when someone opens Work without Work access (Boards access doesn't count). */
export function NoWorkAccess({ workspaceName }: { workspaceName?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="font-serif text-[28px] leading-tight">You don&apos;t have access to Work{workspaceName ? ` in ${workspaceName}` : ""}</h1>
      <p className="mt-2 max-w-md text-[13.5px] text-muted-foreground">
        Work has its own members, separate from Boards. Ask a Work owner or admin to invite you.
      </p>
      <Link href="/home" className="mt-5 rounded-lg bg-forest px-4 py-2 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
        Back to Home
      </Link>
    </div>
  );
}
