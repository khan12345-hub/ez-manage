"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PANE = "board-scroll-pane";

export function BoardHorizontalScrollbar() {
  const railRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [thumbW, setThumbW] = useState(1400);

  /* Measure widest pane scrollWidth */
  const measure = useCallback(() => {
    const panes = document.querySelectorAll<HTMLElement>(`.${PANE}`);
    if (!panes.length) return;
    const w = Math.max(...Array.from(panes).map((p) => p.scrollWidth));
    setThumbW(w);
  }, []);

  /* Sync from a scroll source (either rail or a pane) */
  const syncAll = useCallback(
    (srcLeft: number, srcScrollW: number, srcClientW: number, sourceEl: HTMLElement) => {
      if (syncing.current) return;
      syncing.current = true;

      const maxSrc = srcScrollW - srcClientW;
      const ratio = maxSrc > 0 ? srcLeft / maxSrc : 0;

      document.querySelectorAll<HTMLElement>(`.${PANE}`).forEach((pane) => {
        if (pane === sourceEl) return;
        const max = pane.scrollWidth - pane.clientWidth;
        pane.scrollLeft = ratio * max;
      });

      const rail = railRef.current;
      if (rail && rail !== sourceEl) {
        const max = rail.scrollWidth - rail.clientWidth;
        rail.scrollLeft = ratio * max;
      }

      requestAnimationFrame(() => {
        syncing.current = false;
      });
    },
    [],
  );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const onRailScroll = () =>
      syncAll(rail.scrollLeft, rail.scrollWidth, rail.clientWidth, rail);

    const onPaneScroll = (e: Event) => {
      const pane = e.currentTarget as HTMLElement;
      syncAll(pane.scrollLeft, pane.scrollWidth, pane.clientWidth, pane);
    };

    const attachPanes = () => {
      measure();
      document.querySelectorAll<HTMLElement>(`.${PANE}`).forEach((pane) => {
        pane.removeEventListener("scroll", onPaneScroll);
        pane.addEventListener("scroll", onPaneScroll, { passive: true });
      });
    };

    rail.addEventListener("scroll", onRailScroll, { passive: true });
    attachPanes();

    /* Re-attach when groups are added / removed */
    const mo = new MutationObserver(attachPanes);
    mo.observe(document.body, { childList: true, subtree: true });

    /* Re-measure on column resize / window resize */
    const ro = new ResizeObserver(measure);
    document.querySelectorAll<HTMLElement>(`.${PANE}`).forEach((p) => ro.observe(p));
    window.addEventListener("resize", measure);

    return () => {
      rail.removeEventListener("scroll", onRailScroll);
      document.querySelectorAll<HTMLElement>(`.${PANE}`).forEach((p) => {
        p.removeEventListener("scroll", onPaneScroll);
        ro.unobserve(p);
      });
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [syncAll, measure]);

  return (
    <div
      ref={railRef}
      className="sticky bottom-0 z-50 overflow-x-auto border-t bg-background"
      style={{ height: 14 }}
      aria-hidden="true"
    >
      {/* Phantom content — same width as the widest table */}
      <div style={{ width: thumbW, height: 1 }} />
    </div>
  );
}
