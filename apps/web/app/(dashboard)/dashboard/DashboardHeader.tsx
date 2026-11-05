"use client";

import { useAuth } from "@/providers/AuthProvider";
import { CalendarDays } from "lucide-react";
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


export function DashboardHeader() {
  const { user } = useAuth();
  const firstName = user?.firstName || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(120deg, #eef0ff 0%, #f1edff 55%, #eae7ff 100%)",
        border: "1px solid rgba(99,102,241,0.12)",
        boxShadow: "0 4px 24px rgba(99,102,241,0.1)",
      }}
    >
      {/* soft blobs */}
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "rgba(139,92,246,0.18)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-6 py-6">
        {/* Left — greeting */}
        <div className="min-w-0">
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.5 }}
            className="flex items-center gap-2 text-2xl font-bold text-slate-800"
          >
            <span className="text-2xl">👋</span>
            {getGreeting()}, {firstName}
          </motion.h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening in your workspace today.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary">
            <CalendarDays className="h-4 w-4" />
            {getFormattedDate()}
          </p>

          {/* progress accent */}
          <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-primary/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "70%" }}
              transition={{ delay: 0.5, duration: 0.9, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
            />
          </div>
        </div>

        {/* Middle — quote (hidden on small) */}
        <div className="hidden shrink-0 text-right lg:block">
          <p className="max-w-[180px] text-sm italic leading-snug text-slate-400">
            &ldquo;Great teams don&apos;t just work, they make progress.&rdquo;
          </p>
        </div>

        {/* Right — illustration */}
        <div className="hidden shrink-0 sm:block">
          <motion.img
            src="/images/ezmanage/01_dashboard_illustration.png"
            alt=""
            aria-hidden
            width={236}
            height={164}
            className="h-[150px] w-auto select-none object-contain"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}
