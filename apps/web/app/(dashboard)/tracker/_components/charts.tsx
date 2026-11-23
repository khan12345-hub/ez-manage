"use client";

/*
 * EZ Tracker — shared premium chart bits (Executive Hub glass language).
 * Hand-rolled, dependency-free SVG so every tracker view charts the same way and
 * stays crisp in light + dark. Visual only; no data shapes change.
 * Dataviz palette: green #047857/#059669 (time), blue #2563eb/#3b82f6 (apps/sites),
 * red #dc2626/#f87171 (late / attention).
 */

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { hm } from "@/services/tracker.api";

export const fade: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

/** a number that counts up the first time it is in view (plain numbers; formatter optional) */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!inView || reduced) { setN(value); return; }
    const c = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(v) });
    return () => c.stop();
  }, [inView, value, reduced]);
  return <span ref={ref} className="tabular-nums">{format ? format(n) : Math.round(n).toLocaleString()}</span>;
}

/** premium stat tile with an icon chip and a counting number */
export function StatTile({ icon: Icon, label, value, sub, tone = "#047857", alarm }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; alarm?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={fade} whileHover={reduced ? undefined : { y: -3 }}
      className="group rounded-[22px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_32px_-24px_rgba(11,42,31,0.45)] backdrop-blur-xl transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(11,42,31,0.5)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${tone}16`, color: tone }}><Icon className="h-[18px] w-[18px]" /></span>
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn("mt-2.5 text-[27px] font-bold leading-none tracking-tight tabular-nums", alarm && "text-[#dc2626] dark:text-[#f87171]")}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

/** ring gauge for a single percentage (activity). One hue; the number sits inside. */
export function Ring({ pct, size = 118, stroke = 11, label, tone = "#047857" }: { pct: number; size?: number; stroke?: number; label?: string; tone?: string }) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-black/[0.06] dark:stroke-white/[0.08]" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke={tone}
          strokeDasharray={c} initial={{ strokeDashoffset: reduced ? c * (1 - v / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tabular-nums">{Math.round(v)}%</span>
        {label && <span className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/**
 * Daily hours bars: tracked time as a faint full bar with the active (non-idle) time
 * filled solid in front, so each day reads as a fill level. Hover shows exact numbers.
 */
export function HoursBars({ data, highlight, onBarClick, height = 150 }: {
  data: { key: string; label: string; sub?: string; tracked: number; active: number }[];
  highlight?: string; onBarClick?: (key: string) => void; height?: number;
}) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.tracked));
  const niceMax = max <= 3600 ? Math.ceil(max / 1800) * 1800 : Math.ceil(max / 3600) * 3600;
  return (
    <div>
      <div className="flex items-stretch gap-1.5" style={{ height }}>
        {data.map((d) => {
          const th = (d.tracked / niceMax) * 100;
          const ah = (d.active / niceMax) * 100;
          const Comp: any = onBarClick ? motion.button : motion.div;
          return (
            <Comp key={d.key} type={onBarClick ? "button" : undefined} onClick={onBarClick ? () => onBarClick(d.key) : undefined}
              className={cn("group relative flex flex-1 flex-col justify-end rounded-t-md", onBarClick && "cursor-pointer")}
              title={`${d.label}${d.sub ? ` ${d.sub}` : ""}: ${hm(d.tracked)} tracked · ${hm(d.active)} active`}>
              {/* track (total tracked) */}
              <motion.span className={cn("relative w-full overflow-hidden rounded-t-md bg-[#047857]/15 transition-colors dark:bg-[#059669]/20", highlight === d.key && "bg-[#047857]/25 dark:bg-[#059669]/30")}
                initial={{ height: reduced ? `${th}%` : 0 }} animate={{ height: `${th}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                {/* active fill from the bottom */}
                <span className="absolute inset-x-0 bottom-0 rounded-t-md bg-[#047857] dark:bg-[#059669]" style={{ height: th ? `${(ah / th) * 100}%` : 0 }} />
              </motion.span>
            </Comp>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <div key={d.key} className={cn("flex-1 text-center text-[10.5px] font-medium", highlight === d.key ? "text-foreground" : "text-muted-foreground")}>
            <span className="block">{d.label}</span>
            {d.sub && <span className="block text-[9.5px] opacity-70">{d.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** compact legend for the tracked-vs-active bars */
export function BarLegend() {
  return (
    <div className="flex items-center gap-3.5 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#047857] dark:bg-[#059669]" /> Active</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#047857]/15 dark:bg-[#059669]/25" /> Tracked</span>
    </div>
  );
}
