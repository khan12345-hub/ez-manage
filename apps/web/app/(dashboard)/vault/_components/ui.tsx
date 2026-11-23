"use client";

/*
 * EZ Vault — shared premium UI bits (Executive Hub glass language).
 * Glass cards, stat tiles, motion variants and a count-up number, so every
 * vault view looks like one system. Visual only; nothing here touches crypto.
 */

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/** glass surface for a large card */
export const GLASS = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";
/** glass surface for a small stat tile */
export const TILE = "rounded-[22px] border border-white/70 bg-white/70 shadow-[0_12px_32px_-24px_rgba(11,42,31,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

export const fade: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

/** soft colour behind the glass — lives inside the vault shell (absolute, not fixed) */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#34d399]/20 blur-[110px] dark:bg-[#34d399]/10" />
      <div className="absolute -bottom-40 left-[35%] h-[420px] w-[420px] rounded-full bg-[#b08d57]/18 blur-[120px] dark:bg-[#b08d57]/10" />
      <div className="absolute -right-24 top-24 h-[360px] w-[360px] rounded-full bg-[#0b2a1f]/10 blur-[100px]" />
    </div>
  );
}

/** a number that counts up the first time it scrolls into view */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!inView || reduced) { setN(value); return; }
    const c = animate(0, value, { duration: 1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduced]);
  return <span ref={ref} className="tabular-nums">{n.toLocaleString()}{suffix}</span>;
}

/** scrollable page frame used by every full-width vault view, with the soft backdrop */
export function GlassPage({ title, hint, action, children, max = "max-w-5xl" }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; max?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#eef3f0]/60 dark:bg-transparent">
      <Backdrop />
      <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className={cn("relative mx-auto p-5 sm:p-7", max)}>
        {title && (
          <motion.header variants={fade} className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-[30px] leading-tight">{title}</h1>
              {hint && <p className="mt-1 text-[13.5px] text-muted-foreground">{hint}</p>}
            </div>
            {action}
          </motion.header>
        )}
        {children}
      </motion.div>
    </div>
  );
}

/** one stat tile: icon chip, label, big number, sub-line */
export function StatTile({ icon: Icon, label, value, suffix, sub, tone = "#0b6b4f", onClick, className }: { icon: React.ElementType; label: string; value: number; suffix?: string; sub?: string; tone?: string; onClick?: () => void; className?: string }) {
  const reduced = useReducedMotion();
  const Comp: any = onClick ? motion.button : motion.div;
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick} variants={fade} whileHover={reduced || !onClick ? undefined : { y: -3 }}
      className={cn(TILE, "group flex items-start gap-3 p-4 text-left", onClick && "transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(11,42,31,0.5)]", className)}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${tone}16`, color: tone }}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 block text-[27px] font-bold leading-none tracking-tight"><CountUp value={value} suffix={suffix} /></span>
        {sub && <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{sub}</span>}
      </span>
    </Comp>
  );
}
