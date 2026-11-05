"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { useAuth } from "@/providers/AuthProvider";
import { getAllWorkspaces } from "@/services/workspace.api";

/* ─── helpers ────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── animation variants ─────────────────────────────────────────────────── */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ─── card shadow tokens ─────────────────────────────────────────────────── */

const SHADOW_REST =
  "0 4px 20px rgba(99,102,241,0.07), 0 1px 3px rgba(99,102,241,0.05)";
const SHADOW_HOVER_INDIGO =
  "0 16px 48px rgba(99,102,241,0.15), 0 4px 12px rgba(99,102,241,0.09)";
const SHADOW_HOVER_VIOLET =
  "0 16px 48px rgba(124,58,237,0.15), 0 4px 12px rgba(124,58,237,0.09)";
const SHADOW_REST_MUTED =
  "0 2px 12px rgba(99,102,241,0.04), 0 1px 3px rgba(99,102,241,0.03)";

/* ─── glass surface styles ───────────────────────────────────────────────── */

const glassBase: React.CSSProperties = {
  backdropFilter: "blur(18px) saturate(1.7)",
  WebkitBackdropFilter: "blur(18px) saturate(1.7)",
};


/* ─── GlassCard ──────────────────────────────────────────────────────────── */

interface GlassCardProps {
  href: string;
  accent?: "indigo" | "violet";
  ariaLabel: string;
  hoverShadow?: string;
  cardStyle?: React.CSSProperties;
  accentBarStyle?: React.CSSProperties;
  /** absolutely-positioned decorative illustration (bottom-right) */
  illustration?: React.ReactNode;
  children: React.ReactNode;
}

function GlassCard({
  href,
  accent = "indigo",
  ariaLabel,
  hoverShadow = SHADOW_HOVER_INDIGO,
  cardStyle = {},
  accentBarStyle = {},
  illustration,
  children,
}: GlassCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "focus-within:ring-2 focus-within:ring-offset-2",
        accent === "violet"
          ? "focus-within:ring-violet-500"
          : "focus-within:ring-primary",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...glassBase,
        background: "rgba(255,255,255,0.88)",
        border: "1px solid #E2E7FA",
        boxShadow: SHADOW_REST,
        ...cardStyle,
      }}
      {...(!reduced && {
        whileHover: {
          y: -5,
          boxShadow: hoverShadow,
        },
        transition: { type: "spring", stiffness: 340, damping: 26 },
      })}
    >
      {/* Stretched link — the sole interactive element for click + keyboard */}
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={ariaLabel}
        tabIndex={0}
      />

      {/* Gradient top accent bar */}
      <div
        className="absolute inset-x-0 top-0 z-[1] h-[3px] rounded-t-2xl"
        style={accentBarStyle}
        aria-hidden
      />

      {/* Decorative illustration (bottom-right, behind content, non-interactive) */}
      {illustration}

      {/* Card body — above the background, below the link overlay */}
      <div className="relative z-[2] flex flex-1 flex-col p-6 sm:p-7">
        {children}
      </div>
    </motion.div>
  );
}

/* ─── Task Management feature list ───────────────────────────────────────── */

const TASK_FEATURES: { lead: string; rest: string }[] = [
  { lead: "Kanban, timeline,", rest: " and list views" },
  { lead: "File attachments", rest: " and threaded comments" },
  { lead: "Team chat", rest: " and real-time collaboration" },
  { lead: "Automations, forms,", rest: " and integrations" },
  { lead: "Time tracking", rest: " and capacity planning" },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function HomeSelector() {
  const { user } = useAuth();
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const reduced = useReducedMotion();

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const firstWorkspace = workspaces?.[0];
  const taskHref = firstWorkspace
    ? `/workspace/${(firstWorkspace as any).uid ?? firstWorkspace.id}`
    : "/dashboard";

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: "#F7F8FF",
        backgroundImage: "url('/00-background-soft-gradient.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ── Layered background ──────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="absolute -left-48 -top-48 h-[700px] w-[700px]"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-48 -right-32 h-[600px] w-[600px]"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      
      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col px-5 pb-16 pt-10 sm:px-10 sm:pt-14">
        <div className="mx-auto w-full max-w-[1160px]">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <motion.div
            className="mb-10 flex items-center justify-between gap-8 sm:mb-12"
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            animate="show"
            transition={{ delay: 0.08 }}
          >
            {/* Left — greeting */}
            <div className="min-w-0 max-w-[520px]">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.18)",
                  color: "#5B4BFF",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {getGreeting()}
                {user?.firstName ? `, ${user.firstName}` : ""} 👋
              </span>

              <h1
                className="mt-5 text-[36px] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[48px]"
                style={{ color: "#171B4B" }}
              >
                Your workspace,
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
                  }}
                >
                  your way.
                </span>
              </h1>

              <p className="mt-4 text-[16px] leading-relaxed text-[#7B89AA]">
                Choose a module below to pick up where you left off, or explore
                new tools to get more done.
              </p>

              {/* progress dashes */}
              <div className="mt-6 flex items-center gap-1.5" aria-hidden>
                <span
                  className="h-[3px] w-10 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #6366F1 0%, #7C3AED 100%)",
                  }}
                />
                <span className="h-[3px] w-5 rounded-full bg-primary/25" />
                <span className="h-[3px] w-2.5 rounded-full bg-primary/10" />
              </div>
            </div>

            {/* Right — hero illustration + tagline */}
            <div className="hidden shrink-0 items-center gap-6 lg:flex">
              <motion.img
                src="/02-hero-module-illustration.png"
                alt=""
                aria-hidden
                className="h-[220px] w-auto select-none"
                style={{ mixBlendMode: "multiply" }}
                {...(!reduced && {
                  animate: { y: [0, -8, 0] },
                  transition: {
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                })}
              />
              <div className="relative hidden xl:block" aria-hidden>
                <p
                  className="text-[17px] italic leading-tight"
                  style={{
                    color: "#5B4BFF",
                    fontFamily: "'Segoe Script','Brush Script MT',cursive",
                  }}
                >
                  Better tools.
                  <br />
                  Bigger results.
                </p>
                <svg
                  className="mt-1"
                  width="110"
                  height="10"
                  viewBox="0 0 110 10"
                  fill="none"
                >
                  <path
                    d="M2 6 C 30 2, 80 2, 108 7"
                    stroke="#7C3AED"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* ── Module grid ─────────────────────────────────────────────── */}
          <motion.div
            className={[
              "grid gap-5",
              isSuperAdmin
                ? "grid-cols-1 md:grid-cols-[1.4fr_1fr]"
                : "grid-cols-1",
            ].join(" ")}
            variants={stagger}
            initial={reduced ? false : "hidden"}
            animate="show"
          >

            {/* ── Task Management ─────────────────────────────────────── */}
            <motion.div variants={fadeUp}>
              <GlassCard
                href={taskHref}
                accent="indigo"
                ariaLabel="Open Task Management workspace"
                hoverShadow={SHADOW_HOVER_INDIGO}
                accentBarStyle={{
                  background:
                    "linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)",
                }}
                illustration={
                  <img
                    src={`/images/ezmanage/illustration-task-board.svg`}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute -bottom-4 -right-3 w-[195px] select-none opacity-95 transition-transform duration-300 group-hover:scale-105"
                  />
                }
              >
                <div className="mb-5 flex items-start justify-between">
                  <img
                    src="/06-task-management-icon.png"
                    alt=""
                    aria-hidden
                    className="h-12 w-12 select-none rounded-[12px] object-contain shadow-sm"
                  />
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold leading-none"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.18)",
                      color: "#5B4BFF",
                    }}
                  >
                    <Sparkles className="h-[10px] w-[10px]" aria-hidden />
                    Most Popular
                  </span>
                </div>

                <div className="flex-1">
                  <h2
                    className="text-[20px] font-bold leading-snug"
                    style={{ color: "#171B4B" }}
                  >
                    Task Management
                  </h2>
                  <p className="mt-2 max-w-[340px] text-[13px] leading-[1.65] text-[#7B89AA]">
                    Boards, tasks, groups, docs, and project workflows —
                    everything your team needs to stay aligned and ship.
                  </p>

                  <ul className="mt-5 flex flex-col gap-2.5" role="list">
                    {TASK_FEATURES.map((f) => (
                      <li
                        key={f.lead}
                        className="flex items-center gap-2.5 text-[12.5px] text-[#7B89AA]"
                      >
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>
                          <span className="font-semibold text-[#171B4B]">
                            {f.lead}
                          </span>
                          {f.rest}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA — styled as a button; the whole card is the link */}
                <div
                  className="mt-7 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md transition-transform duration-150 group-hover:translate-y-[-1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
                    boxShadow: "0 8px 20px rgba(99,102,241,0.3)",
                  }}
                >
                  Open workspace
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* ── CEO Dashboard (SUPER_ADMIN only) ────────────────────── */}
            {isSuperAdmin && (
              <motion.div variants={fadeUp}>
                <GlassCard
                  href="/ceo-assistant"
                  accent="violet"
                  ariaLabel="Open CEO Dashboard"
                  hoverShadow={SHADOW_HOVER_VIOLET}
                  cardStyle={{
                    background: "rgba(249,246,255,0.9)",
                    border: "1px solid #E4DBF9",
                  }}
                  accentBarStyle={{
                    background:
                      "linear-gradient(90deg, #7C3AED 0%, #6366F1 100%)",
                  }}
                  illustration={
                    <img
                      src={`/04-ceo-dashboard-card-illustration.png`}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute -bottom-3 -right-4 w-[170px] select-none opacity-90 transition-transform duration-300 group-hover:scale-105"
                    />
                  }
                >
                  <div className="mb-4 flex items-start justify-between">
                    <img
                      className="h-12 w-12 select-none rounded-[12px] object-contain shadow-sm"
                      src="/07-ceo-dashboard-icon.png"
                      alt=""
                      aria-hidden
                    />
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold leading-none"
                      style={{
                        background: "rgba(124,58,237,0.09)",
                        border: "1px solid rgba(124,58,237,0.18)",
                        color: "#6D28D9",
                      }}
                    >
                      <Lock className="h-[10px] w-[10px]" aria-hidden />
                      Restricted
                    </span>
                  </div>

                  <div className="flex-1">
                    <h2
                      className="text-[20px] font-bold leading-snug"
                      style={{ color: "#171B4B" }}
                    >
                      CEO Dashboard
                    </h2>
                    <p className="mt-2 max-w-[230px] text-[13px] leading-[1.65] text-[#7B89AA]">
                      Executive insights, team analytics, and AI-assisted meeting
                      management.
                    </p>
                  </div>

                  <div
                    className="mt-6 flex items-center gap-1.5 text-[13px] font-semibold"
                    style={{ color: "#7C3AED" }}
                  >
                    Open dashboard
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </div>
                </GlassCard>
              </motion.div>
            )}

          </motion.div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <motion.footer
        className="relative z-10 flex items-center justify-center px-5 py-5"
        style={{ borderTop: "1px solid rgba(99,102,241,0.08)" }}
        variants={fadeUp}
        initial={reduced ? false : "hidden"}
        animate="show"
        transition={{ delay: 0.6 }}
      >
        <p className="text-[11px] font-medium tracking-wide text-[#7B89AA]">
          EzManage · Task management for modern teams
        </p>
      </motion.footer>
    </div>
  );
}
