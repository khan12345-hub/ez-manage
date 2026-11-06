"use client";

import { useAuth } from "@/providers/AuthProvider";
import { motion } from "framer-motion";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Ledger header: card with a fine grid, mono date, serif greeting. */
export function DashboardHeader() {
  const { user } = useAuth();
  const firstName = user?.firstName || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_12px_32px_-18px_rgb(11_42_31/0.25)]"
    >
      {/* emerald → brass hairline, fine ledger grid, soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgb(4 120 87 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(4 120 87 / 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(90deg, transparent, black 55%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 55%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-7">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {getFormattedDate()}
          </p>
          <motion.h1
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mt-2 font-serif text-[34px] font-normal leading-[1.05] tracking-tight text-foreground sm:text-[42px]"
          >
            {getGreeting()},{" "}
            <span
              className="bg-clip-text italic text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, var(--primary) 0%, var(--accent-foreground) 50%, var(--brass) 100%)" }}
            >
              {firstName}.
            </span>
          </motion.h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across your workspaces today.
          </p>
        </div>

        <motion.img
          src="/images/ezmanage/ledger/hero.svg"
          alt=""
          aria-hidden
          width={240}
          height={150}
          className="hidden h-[150px] w-auto shrink-0 select-none sm:block"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          draggable={false}
        />
      </div>
    </motion.div>
  );
}
