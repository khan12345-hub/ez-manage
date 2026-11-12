"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProductAccess } from "@/hooks/useProductAccess";

/** Boards pages: only for people with Boards access. */
const BOARDS_PATH = /^\/(dashboard|workspace)(\/|$)/;

/**
 * Sends people away from a product they don't have: someone invited only to Work
 * never lands in Boards (and vice versa) — they go to their own product instead.
 * Work's own pages guard themselves (work/[workspaceId]/layout, /work, /work/create).
 */
export function ProductGate() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const access = useProductAccess();
  const checking = useRef(false);

  useEffect(() => {
    if (access.loading || checking.current || !BOARDS_PATH.test(pathname) || access.hasBoards) return;
    checking.current = true;
    // look again before sending them off: a just-accepted Boards invite may not be cached yet
    access.refetch().then(([b]) => {
      checking.current = false;
      const fresh = (b.data as any[] | undefined) ?? [];
      if (!fresh.length && BOARDS_PATH.test(window.location.pathname)) {
        router.replace(access.workHref ?? (access.hasCeo ? "/ceo" : "/home"));
      }
    });
  }, [access, pathname, router]);

  return null;
}
