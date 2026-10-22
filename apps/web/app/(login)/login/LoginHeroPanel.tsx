"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Zap, Users, TrendingUp } from "lucide-react";

// ── Static decorative data ─────────────────────────────────────────────
const FEATURES = [
  { icon: Zap,        label: "Work Smarter",    desc: "Save time & focus" },
  { icon: Users,      label: "Better Together", desc: "Collaborate in real-time" },
  { icon: TrendingUp, label: "Grow Faster",     desc: "Turn plans into results" },
] as const;

const PALETTE_DARK = ["#6361F0", "#059669", "#0EA5E9", "#7C3AED", "#EC4899"];
const PALETTE_LIGHT = ["#6361F0", "#059669", "#0EA5E9", "#7C3AED", "#EC4899"];

// ── Avatar stacks ──────────────────────────────────────────────────────
function LightAvatars({ count, offset = 0, size = 18 }: { count: number; offset?: number; size?: number }) {
  return (
    <div className="flex -space-x-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: PALETTE_LIGHT[(offset + i) % PALETTE_LIGHT.length],
            boxShadow: "0 0 0 1.5px white",
          }}
        />
      ))}
    </div>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────
function ProgressBar({ value, color, delay, reduced, trackColor }: {
  value: number; color: string; delay: number; reduced: boolean; trackColor?: string;
}) {
  return (
    <div
      className="relative h-[3px] w-full overflow-hidden rounded-full"
      style={{ background: trackColor ?? "rgba(255,255,255,0.1)" }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color, width: `${value}%`, transformOrigin: "left" }}
        initial={reduced ? undefined : { scaleX: 0 }}
        animate={reduced ? undefined : { scaleX: 1 }}
        transition={{ duration: 1.1, delay, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Dashboard Mockup — real app screenshot with floating cards ────────
function DashboardMockup({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[400px]">

      {/* ── Floating progress card — white, top right ─────────────── */}
      <motion.div
        className="absolute -right-3 -top-10 z-20 w-[158px] rounded-2xl bg-white p-3"
        style={{
          border: "1px solid rgba(120,110,255,0.14)",
          boxShadow: "0 12px 40px rgba(30,20,120,0.25)",
        }}
        animate={reduced ? {} : { y: [0, -9, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      >
        <p className="mb-2 text-[9.5px] font-semibold text-gray-500">Project Progress</p>
        <div className="flex items-center gap-2.5">
          <div className="relative h-11 w-11 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(100,97,240,0.1)" strokeWidth="3.5" />
              <motion.circle
                cx="18" cy="18" r="15.9"
                fill="none" stroke="#6361F0" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray="100" strokeDashoffset="100"
                initial={reduced ? undefined : { strokeDashoffset: 100 }}
                animate={reduced ? undefined : { strokeDashoffset: 22 }}
                transition={{ duration: 1.4, delay: 1.0, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-gray-800">78%</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <ProgressBar value={85} color="#6361F0" delay={1.0} reduced={reduced} trackColor="rgba(99,97,240,0.1)" />
            <ProgressBar value={62} color="#10B981" delay={1.1} reduced={reduced} trackColor="rgba(16,185,129,0.1)" />
            <ProgressBar value={44} color="#F59E0B" delay={1.2} reduced={reduced} trackColor="rgba(245,158,11,0.1)" />
          </div>
        </div>
      </motion.div>

      {/* ── Real app screenshot with 3-D tilt ─────────────────────── */}
      <div style={{ perspective: "1200px" }}>
        <div
          className="relative z-10 overflow-hidden rounded-2xl"
          style={{
            transform: "rotateX(4deg) rotateY(-6deg)",
            boxShadow: "0 28px 70px rgba(10,8,80,0.5), 0 4px 16px rgba(10,8,80,0.28)",
            border: "1px solid rgba(100,100,230,0.18)",
          }}
        >
          <Image
            src="/hero-dashboard.png"
            alt="EzManage board view"
            width={1440}
            height={900}
            className="block w-full h-auto"
            priority
            unoptimized
          />
        </div>
      </div>

      {/* ── Floating team card — white, bottom left ───────────────── */}
      <motion.div
        className="absolute -bottom-7 -left-3 z-20 w-[162px] rounded-2xl bg-white p-3"
        style={{
          border: "1px solid rgba(120,110,255,0.14)",
          boxShadow: "0 12px 40px rgba(30,20,120,0.25)",
        }}
        animate={reduced ? {} : { y: [0, 9, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      >
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(99,97,240,0.12)" }}
          >
            <Users className="h-3.5 w-3.5 text-[#6361F0]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold leading-tight text-gray-800">Team Work</p>
            <p className="text-[8.5px] leading-tight text-gray-400">Makes the Dream Work</p>
          </div>
        </div>
        <LightAvatars count={4} offset={1} size={20} />
      </motion.div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export function LoginHeroPanel() {
  const reduced = useReducedMotion();

  const outerVars: Variants = {
    hidden: {},
    visible: {
      transition: reduced ? {} : { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const itemVars: Variants = {
    hidden: reduced ? {} : { opacity: 0, y: 22 },
    visible: reduced
      ? {}
      : {
          opacity: 1,
          y: 0,
          transition: { duration: 0.52, ease: [0.25, 0.46, 0.45, 0.94] },
        },
  };

  return (
    <aside
      className="relative hidden overflow-hidden shrink-0 lg:flex lg:w-[48%] xl:w-[50%] flex-col px-10 py-10 xl:px-12"
      style={{
        backgroundImage: [
          "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          "linear-gradient(145deg, #16138C 0%, #221EC8 35%, #2E2AE0 60%, #1A17A0 100%)",
        ].join(", "),
        backgroundSize: "26px 26px, 100% 100%",
      }}
      aria-hidden="true"
    >
      {/* ── Globe / planet — deep blue sphere top right ────────────── */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-[240px] w-[240px] rounded-full xl:h-[280px] xl:w-[280px]"
        style={{
          background: "radial-gradient(circle at 40% 35%, rgba(120,140,255,0.9) 0%, rgba(60,80,220,1) 30%, rgba(30,40,180,1) 60%, rgba(10,12,130,1) 100%)",
          boxShadow: "0 0 80px rgba(80,100,255,0.5), 0 0 160px rgba(60,80,220,0.25)",
          border: "1px solid rgba(130,150,255,0.2)",
        }}
      />
      {/* Outer halo ring */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 rounded-full xl:-right-24 xl:-top-24"
        style={{
          width: "340px",
          height: "340px",
          border: "1px solid rgba(120,140,255,0.1)",
          background: "transparent",
        }}
      />

      {/* ── Diagonal light plane (cross-shine) ─────────────────────── */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "22%",
          left: "-15%",
          width: "145%",
          height: "28px",
          background: "linear-gradient(90deg, transparent 0%, rgba(180,200,255,0.06) 20%, rgba(200,220,255,0.18) 48%, rgba(180,200,255,0.06) 78%, transparent 100%)",
          transform: "rotate(-24deg)",
          transformOrigin: "center",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: "22%",
          left: "-15%",
          width: "145%",
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(200,220,255,0.2) 25%, rgba(210,230,255,0.5) 50%, rgba(200,220,255,0.2) 75%, transparent 100%)",
          transform: "rotate(-24deg)",
          transformOrigin: "center",
        }}
      />
      {/* Second plane — slightly offset */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "28%",
          left: "-15%",
          width: "145%",
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(200,220,255,0.08) 30%, rgba(210,230,255,0.2) 50%, rgba(200,220,255,0.08) 70%, transparent 100%)",
          transform: "rotate(-24deg)",
          transformOrigin: "center",
        }}
      />

      {/* ── Bottom purple wave ──────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 400 72" preserveAspectRatio="none" style={{ width: "100%", height: "72px" }} aria-hidden="true">
          <path d="M0,48 Q60,12 140,36 T280,18 T400,28 L400,72 L0,72 Z" fill="rgba(90,40,200,0.3)" />
          <path d="M0,58 Q90,32 200,50 T400,38 L400,72 L0,72 Z" fill="rgba(60,20,160,0.22)" />
        </svg>
      </div>

      {/* ── Bottom-left accent orb ──────────────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(100,50,220,0.55) 0%, transparent 65%)" }}
        animate={reduced ? {} : { y: [0, 22, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* ── Brand mark ─────────────────────────────────────────────── */}
      <div className="relative z-10 mb-6 flex shrink-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: "rgba(255,255,255,0.14)" }}
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
            <rect x="0"  y="0"   width="18" height="2.5" rx="1.25" fill="white" fillOpacity="0.92" />
            <rect x="0"  y="6.5" width="13" height="2.5" rx="1.25" fill="white" fillOpacity="0.70" />
            <rect x="0"  y="13"  width="8"  height="2.5" rx="1.25" fill="white" fillOpacity="0.48" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-white">EzManage</span>
      </div>

      {/* ── Staggered content ──────────────────────────────────────── */}
      <motion.div
        className="relative z-10 flex flex-1 flex-col justify-between"
        variants={outerVars}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "visible"}
      >
        {/* Headline + features */}
        <div className="flex flex-col gap-5">
          <motion.div variants={itemVars} className="flex flex-col gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.42)" }}>
              Smart Task Management
            </p>
            <h2 className="text-[1.875rem] xl:text-[2.125rem] font-bold leading-[1.13] tracking-tight text-white">
              Turn Ideas Into<br />
              Real{" "}
              <span style={{ color: "rgba(180,175,255,0.96)" }}>Progress</span>
            </h2>
            <p className="text-[0.84rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)" }}>
              Organize your work, collaborate with your team,<br />
              and achieve more — all in one place.
            </p>
          </motion.div>

          <motion.div variants={itemVars} className="flex gap-4 xl:gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-1 flex-col items-start gap-1.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(20,15,100,0.55)",
                    border: "1px solid rgba(130,120,255,0.22)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10.5px] font-semibold leading-tight text-white">{label}</p>
                <p className="text-[9.5px] leading-tight" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <motion.div variants={itemVars} className="py-10">
          <DashboardMockup reduced={!!reduced} />
        </motion.div>

        {/* Trust bar */}
        <motion.div variants={itemVars} className="flex items-center gap-3">
          <div className="flex -space-x-2 shrink-0">
            {PALETTE_DARK.slice(0, 4).map((color, i) => (
              <div
                key={i}
                className="h-[26px] w-[26px] rounded-full"
                style={{ background: color, boxShadow: "0 0 0 2px rgba(22,19,140,0.9)" }}
              />
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.42)" }}>
            <span className="font-semibold text-white">Trusted by 10,000+ teams</span>
            {" "}to manage their work
          </p>
        </motion.div>
      </motion.div>
    </aside>
  );
}
