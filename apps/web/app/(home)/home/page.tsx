"use client";

/*
 * Home: the three-products launcher in "Ledger glass".
 * A graphic backdrop (orbs, brass orbits, ledger grid) sits behind frosted
 * panels. Every number is live data for the signed-in user; the brief is
 * composed from those same tasks and meetings, never invented.
 */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Hammer,
  LayoutGrid,
  ListChecks,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { useAuth } from "@/providers/AuthProvider";
import { getAllWorkspaces } from "@/services/workspace.api";
import { useLogout } from "@/services/auth/auth.hooks";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  useDashboardTasks,
  useDashboardMeetings,
  isOverdue,
  taskBucket,
} from "@/app/(dashboard)/dashboard/useDashboardData";
import type { AssignedTask } from "@/services/tasks.api";
import { cn } from "@/lib/utils";

/* ─── helpers ───────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar day of a stored due date ("YYYY-MM-DD" or ISO). */
function dueDay(due: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(due);
  return dayStart(d);
}

function shortDate(d: Date) {
  const otherYear = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(otherYear ? { year: "numeric" } : {}),
  });
}

const DAY_MS = 86_400_000;

/* ─── animation ─────────────────────────────────────────────────────────── */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ─── backdrop graphic ──────────────────────────────────────────────────── */

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden>
      {/* colour orbs: the glass panels blur these */}
      <div className="absolute -left-40 -top-56 h-[640px] w-[640px] rounded-full bg-[#34d399]/30 blur-[110px] dark:bg-[#34d399]/12" />
      <div className="absolute -right-32 top-[8%] h-[520px] w-[520px] rounded-full bg-[#d9bd8c]/40 blur-[120px] dark:bg-[#b08d57]/15" />
      <div className="absolute bottom-[-220px] left-[30%] h-[560px] w-[560px] rounded-full bg-[#047857]/20 blur-[120px] dark:bg-[#047857]/20" />

      {/* ledger grid, fading out toward the bottom */}
      <div
        className="absolute inset-0 opacity-70 dark:opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgb(4 120 87 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(4 120 87 / 0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(1100px 620px at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(1100px 620px at 50% 0%, black, transparent 75%)",
        }}
      />

      {/* brass orbits behind the greeting */}
      <svg
        className="absolute -right-24 -top-24 h-[620px] w-[900px] opacity-80 dark:opacity-50"
        viewBox="0 0 900 620"
        fill="none"
      >
        <ellipse cx="560" cy="250" rx="360" ry="150" transform="rotate(-14 560 250)" stroke="#b08d57" strokeOpacity="0.45" strokeDasharray="3 9" />
        <ellipse cx="560" cy="250" rx="270" ry="108" transform="rotate(-14 560 250)" stroke="#047857" strokeOpacity="0.22" />
        <ellipse cx="560" cy="250" rx="440" ry="196" transform="rotate(-14 560 250)" stroke="#047857" strokeOpacity="0.12" />
        <circle cx="236" cy="318" r="5" fill="#b08d57" fillOpacity="0.7" />
        <circle cx="820" cy="150" r="4" fill="#047857" fillOpacity="0.55" />
        <circle cx="300" cy="166" r="3" fill="#047857" fillOpacity="0.45" />
        <path d="M712 92l3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5 9-3.5z" fill="#b08d57" fillOpacity="0.75" />
      </svg>
    </div>
  );
}

/* ─── card graphics (decorative, inline so they follow the theme) ──────── */

function BoardsGraphic() {
  return (
    <svg viewBox="0 0 132 84" className="h-[84px] w-[132px]" fill="none" aria-hidden>
      {[0, 44, 88].map((x, i) => (
        <g key={x}>
          <rect x={x} y="0" width="40" height="6" rx="3" fill={["#047857", "#b08d57", "#34d399"][i]} />
          <rect x={x} y="12" width="40" height="26" rx="6" className="fill-white/80 dark:fill-white/10" stroke="currentColor" strokeOpacity="0.12" />
          {i < 2 && <rect x={x} y="44" width="40" height="26" rx="6" className="fill-white/80 dark:fill-white/10" stroke="currentColor" strokeOpacity="0.12" />}
          <rect x={x + 7} y="21" width="22" height="4" rx="2" fill="currentColor" fillOpacity="0.35" />
          {i < 2 && <rect x={x + 7} y="53" width="16" height="4" rx="2" fill="currentColor" fillOpacity="0.25" />}
        </g>
      ))}
      <path d="M95 25l3 3 6-6" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkGraphic() {
  return (
    <svg viewBox="0 0 132 84" className="h-[84px] w-[132px]" fill="none" aria-hidden>
      <path d="M10 8v62M10 30h14M10 54h14" stroke="#b08d57" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="0" y="0" width="54" height="14" rx="5" fill="#0b2a1f" />
      <rect x="6" y="5" width="5" height="5" rx="1.5" fill="#34d399" />
      <rect x="15" y="5.5" width="30" height="3.5" rx="1.75" fill="#e9efe9" fillOpacity="0.8" />
      <rect x="26" y="23" width="40" height="14" rx="5" className="fill-white/80 dark:fill-white/10" stroke="#047857" strokeOpacity="0.6" />
      <rect x="26" y="47" width="40" height="14" rx="5" className="fill-white/80 dark:fill-white/10" stroke="currentColor" strokeOpacity="0.12" />
      <circle cx="106" cy="42" r="22" stroke="currentColor" strokeOpacity="0.1" strokeWidth="6" />
      <circle cx="106" cy="42" r="22" stroke="#047857" strokeWidth="6" strokeLinecap="round" strokeDasharray="96 139" transform="rotate(-90 106 42)" />
      <circle cx="106" cy="42" r="3.5" fill="#b08d57" />
    </svg>
  );
}

function CeoGraphic() {
  return (
    <svg viewBox="0 0 132 84" className="h-[84px] w-[132px]" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ceoBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0c79b" />
          <stop offset="1" stopColor="#b08d57" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="ceoArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[[6, 52, 26], [28, 42, 36], [50, 46, 32], [72, 30, 48], [94, 20, 58]].map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="14" height={h} rx="3" fill="url(#ceoBar)" />
      ))}
      <path d="M13 48 L35 38 L57 41 L79 26 L101 16 L124 8 L124 78 L13 78 Z" fill="url(#ceoArea)" />
      <path d="M13 48 L35 38 L57 41 L79 26 L101 16 L124 8" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="124" cy="8" r="3.5" fill="#34d399" />
    </svg>
  );
}

/* ─── product card ──────────────────────────────────────────────────────── */

type Tone = "boards" | "work" | "ceo";

function ProductCard({
  tone,
  href,
  icon: Icon,
  kicker,
  title,
  blurb,
  graphic,
  stats,
  footer,
}: {
  tone: Tone;
  href?: string;
  icon: typeof LayoutGrid;
  kicker: string;
  title: string;
  blurb: string;
  graphic: React.ReactNode;
  stats?: { value: React.ReactNode; label: string; alert?: boolean }[];
  footer: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const dark = tone === "ceo";
  return (
    <motion.article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl p-6",
        dark ? "ez-glass-forest" : "ez-glass text-foreground",
        tone === "work" && "border-dashed",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background",
      )}
      {...(!reduced && href && {
        whileHover: { y: -4 },
        transition: { type: "spring", stiffness: 340, damping: 26 },
      })}
    >
      {href && <Link href={href} className="absolute inset-0 z-10 rounded-2xl" aria-label={`Open ${title}`} />}

      {/* top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: dark
            ? "linear-gradient(90deg, transparent, rgb(224 199 155 / 0.7), transparent)"
            : "linear-gradient(90deg, transparent, rgb(255 255 255 / 1), transparent)",
        }}
        aria-hidden
      />
      {/* dark card: fine ledger grid */}
      {dark && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.035) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-xl",
            tone === "boards" && "bg-product-boards/12 text-product-boards ring-1 ring-product-boards/25 dark:bg-product-boards/20 dark:text-[#a5b4fc]",
            tone === "work" && "bg-primary/12 text-primary ring-1 ring-primary/25",
            tone === "ceo" && "bg-white/5 text-brass-soft ring-1 ring-brass/50",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </span>
        <span
          className={cn(
            "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]",
            tone === "boards" && "text-product-boards dark:text-[#a5b4fc]",
            tone === "work" && "text-primary",
            tone === "ceo" && "text-brass-soft",
          )}
        >
          {kicker}
        </span>
      </div>

      {/* graphic, floating top-right under the kicker */}
      <div
        className={cn(
          "pointer-events-none absolute right-5 top-[58px] transition-transform duration-500 group-hover:-translate-y-1",
          dark ? "text-white opacity-90" : "text-foreground opacity-80",
        )}
      >
        {graphic}
      </div>

      <h2 className={cn("relative mt-5 font-serif text-[30px] font-normal leading-none tracking-tight", dark ? "text-white" : "text-foreground")}>
        {title}
      </h2>
      <p className={cn("relative mt-2 max-w-[62%] text-[13px] leading-relaxed", dark ? "text-[#b9c8be]" : "text-muted-foreground")}>
        {blurb}
      </p>

      <div className={cn("relative mt-5 border-t", dark ? "border-white/10" : "border-foreground/10")} />

      {stats ? (
        <dl className="relative mt-4 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd
                className={cn(
                  "font-mono text-[22px] font-medium leading-none tabular-nums",
                  s.alert ? (dark ? "text-[#fca5a5]" : "text-destructive") : dark ? "text-white" : "text-foreground",
                )}
              >
                {s.value}
              </dd>
              <dt className={cn("mt-1.5 truncate text-[11.5px]", dark ? "text-[#b9c8be]" : "text-muted-foreground")}>{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="relative mt-auto pt-5">{footer}</div>
    </motion.article>
  );
}

/* ─── attention list ───────────────────────────────────────────────────── */

type AttentionKind = "overdue" | "today" | "week";
const KIND_META: Record<AttentionKind, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-500/12 text-red-700 ring-red-500/20 dark:text-red-300" },
  today: { label: "Due today", cls: "bg-amber-500/14 text-amber-800 ring-amber-500/25 dark:text-amber-300" },
  week: { label: "This week", cls: "bg-primary/10 text-accent-foreground ring-primary/20" },
};

/* ─── ask box (streams from the existing EZ assistant endpoint) ────────── */

function useAskAssistant(context: string) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ask = async (question: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    setAnswer("");
    setLoading(true);
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `${question}\n\n(Context — my current work:\n${context})` }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = "The assistant is unavailable right now. Please try again.";
        try { msg = (await res.json()).error ?? msg; } catch {}
        setAnswer(msg);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) { acc += delta; setAnswer(acc); }
          } catch {}
        }
      }
      if (!acc) setAnswer("No answer came back. Please try again.");
    } catch (e: any) {
      setAnswer(e?.name === "AbortError" ? "That took too long. Please try again." : "Could not reach the assistant.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  return { answer, loading, ask };
}

/* ─── page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const reduced = useReducedMotion();
  const logout = useLogout();

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const { tasks, isLoading: tasksLoading } = useDashboardTasks();
  const { meetings } = useDashboardMeetings();

  const wsList = (workspaces as any[] | undefined) ?? [];
  const firstWorkspace = wsList[0];
  const boardsHref = firstWorkspace ? `/workspace/${firstWorkspace.uid ?? firstWorkspace.id}` : "/dashboard";

  // boardId → board URL, and the number of boards this user is on
  const { boardLink, boardCount } = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of (user?.boardMemberships ?? []) as any[]) {
      const b = m.board;
      const ws = b?.workspace;
      if (b?.id && ws) map.set(b.id, `/workspace/${ws.uid ?? ws.id}/board/${b.uid ?? b.id}`);
    }
    return { boardLink: map, boardCount: map.size };
  }, [user]);

  const stats = useMemo(() => {
    const today = dayStart(new Date());
    const in7 = new Date(today.getTime() + 7 * DAY_MS);

    const open = tasks.filter((t) => taskBucket(t) !== "done");
    const overdue = open.filter(isOverdue);
    const dueToday = open.filter((t) => t.dueDate && dueDay(t.dueDate).getTime() === today.getTime());
    const dueWeek = open.filter((t) => {
      if (!t.dueDate) return false;
      const d = dueDay(t.dueDate);
      return d > today && d < in7;
    });

    const byDue = (a: AssignedTask, b: AssignedTask) => dueDay(a.dueDate!).getTime() - dueDay(b.dueDate!).getTime();
    const overdueSorted = [...overdue].sort(byDue);
    const weekSorted = [...dueWeek].sort(byDue);
    const attention: { task: AssignedTask; kind: AttentionKind }[] = [
      ...overdueSorted.map((task) => ({ task, kind: "overdue" as const })),
      ...dueToday.map((task) => ({ task, kind: "today" as const })),
      ...weekSorted.map((task) => ({ task, kind: "week" as const })),
    ];

    return { today, open, overdue: overdueSorted, dueToday, dueWeek: weekSorted, attention };
  }, [tasks]);

  const needYou = stats.overdue.length + stats.dueToday.length;
  const upcoming = meetings.filter((m) => new Date(m.scheduledAt).getTime() >= Date.now());

  // Brief lines, composed only from live data
  const brief = useMemo(() => {
    const lines: { lead: string; text: string }[] = [];
    const o = stats.overdue;
    if (o.length) {
      const oldest = o[0]!;
      const late = Math.round((stats.today.getTime() - dueDay(oldest.dueDate!).getTime()) / DAY_MS);
      const boards = new Set(o.map((t) => t.boardName)).size;
      lines.push({
        lead: "Overdue",
        text: `${o.length} ${o.length === 1 ? "task" : "tasks"} across ${boards} ${boards === 1 ? "board" : "boards"}. The oldest, “${oldest.name}”, is ${late} ${late === 1 ? "day" : "days"} late.`,
      });
    } else {
      lines.push({ lead: "Overdue", text: "Nothing is late. Good place to be." });
    }
    if (stats.dueToday.length) {
      const names = stats.dueToday.slice(0, 2).map((t) => `“${t.name}”`).join(" and ");
      const more = stats.dueToday.length > 2 ? ` and ${stats.dueToday.length - 2} more` : "";
      lines.push({ lead: "Today", text: `${names}${more} ${stats.dueToday.length === 1 ? "is" : "are"} due.` });
    }
    if (stats.dueWeek.length) {
      lines.push({
        lead: "This week",
        text: `${stats.dueWeek.length} more due by ${shortDate(dueDay(stats.dueWeek[stats.dueWeek.length - 1]!.dueDate!))}; next is “${stats.dueWeek[0]!.name}”.`,
      });
    }
    if (upcoming[0]) {
      const at = new Date(upcoming[0].scheduledAt);
      lines.push({
        lead: "Meetings",
        text: `Next is “${upcoming[0].title}”, ${at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`,
      });
    }
    return lines;
  }, [stats, upcoming]);

  const askContext = useMemo(
    () =>
      stats.attention
        .slice(0, 12)
        .map(({ task, kind }) => `- [${KIND_META[kind].label}] ${task.name} (board: ${task.boardName}${task.dueDate ? `, due ${task.dueDate}` : ""})`)
        .join("\n") || "- No overdue or upcoming tasks.",
    [stats.attention],
  );
  const { answer, loading: asking, ask } = useAskAssistant(askContext);
  const [question, setQuestion] = useState("");

  const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "EZ";
  const visibleAttention = stats.attention.slice(0, 6);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <Backdrop />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="relative z-20 px-4 pt-4 sm:px-8">
        <div className="ez-glass mx-auto flex h-14 max-w-[1200px] items-center gap-3 rounded-2xl px-3 sm:px-4">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-forest font-serif text-lg leading-none text-brass-soft ring-1 ring-brass/40">
              EZ
            </span>
            <span className="hidden text-[15px] font-semibold text-foreground sm:inline">EZ Manage</span>
          </Link>
          <span className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-2.5 border-l border-foreground/10 pl-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-xs font-semibold text-brass-soft">
              {initials}
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block text-[13px] font-semibold text-foreground">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
              </span>
              <span className="block text-[11.5px] text-muted-foreground">{isSuperAdmin ? "Super admin" : "Team member"}</span>
            </span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 pb-14 pt-8 sm:px-8 sm:pt-12">
        <div className="mx-auto w-full max-w-[1200px]">
          {/* ── Greeting ──────────────────────────────────────────────── */}
          <motion.div
            className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6"
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            animate="show"
          >
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{dateLine}</p>
              <h1 className="mt-3 font-serif text-[40px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[60px]">
                {getGreeting()},{" "}
                <span
                  className="bg-clip-text italic text-transparent"
                  style={{ backgroundImage: "linear-gradient(120deg, var(--primary) 0%, var(--accent-foreground) 50%, var(--brass) 100%)" }}
                >
                  {user?.firstName ?? "there"}.
                </span>
              </h1>
              <p className="mt-3 text-[15px] text-muted-foreground">
                {tasksLoading
                  ? "Gathering your work…"
                  : needYou > 0
                    ? <>You have <strong className="font-semibold text-foreground">{needYou} {needYou === 1 ? "task" : "tasks"}</strong> that need you today.</>
                    : "Nothing needs you urgently today."}
              </p>
            </div>

            <dl className="ez-glass flex items-stretch divide-x divide-foreground/10 rounded-2xl px-2 py-3">
              {[
                { v: wsList.length, l: wsList.length === 1 ? "workspace" : "workspaces" },
                { v: tasksLoading ? "–" : stats.open.length, l: "open tasks" },
                { v: tasksLoading ? "–" : needYou, l: "need you", brass: true },
              ].map((s) => (
                <div key={s.l} className="px-5 text-right">
                  <dd className={cn("font-serif text-[34px] leading-none tabular-nums", s.brass ? "text-[#b45309] dark:text-brass-soft" : "text-foreground")}>
                    {s.v}
                  </dd>
                  <dt className="mt-1.5 text-[11.5px] text-muted-foreground">{s.l}</dt>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* ── Product cards ─────────────────────────────────────────── */}
          <motion.div
            className={cn(
              "mt-9 grid grid-cols-1 gap-5",
              isSuperAdmin ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
            )}
            variants={stagger}
            initial={reduced ? false : "hidden"}
            animate="show"
          >
            <motion.div variants={fadeUp}>
              <ProductCard
                tone="boards"
                href={boardsHref}
                icon={LayoutGrid}
                kicker="Operations"
                title="Boards"
                blurb="Day-to-day tables, Kanban and forms for every team."
                graphic={<BoardsGraphic />}
                stats={[
                  { value: boardCount, label: boardCount === 1 ? "board" : "boards" },
                  { value: tasksLoading ? "–" : stats.dueToday.length + stats.dueWeek.length, label: "due this week" },
                  { value: tasksLoading ? "–" : stats.overdue.length, label: "overdue", alert: stats.overdue.length > 0 },
                ]}
                footer={
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-product-boards dark:text-[#a5b4fc]">
                    Open Boards
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                }
              />
            </motion.div>

            <motion.div variants={fadeUp}>
              <ProductCard
                tone="work"
                href={firstWorkspace ? `/work/${firstWorkspace.uid ?? firstWorkspace.id}` : undefined}
                icon={ListChecks}
                kicker="Projects"
                title="Work"
                blurb="Spaces, lists and tasks for every project."
                graphic={<WorkGraphic />}
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    {["Spaces", "Lists", "Board", "Calendar"].map((f) => (
                      <span key={f} className="rounded-full bg-primary/8 px-2.5 py-1 text-[11.5px] font-medium text-accent-foreground ring-1 ring-primary/15">
                        {f}
                      </span>
                    ))}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                      Open Work
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                }
              />
            </motion.div>

            {isSuperAdmin && (
              <motion.div variants={fadeUp} className="md:col-span-2 lg:col-span-1">
                <ProductCard
                  tone="ceo"
                  icon={BarChart3}
                  kicker="Executive"
                  title="CEO Tower"
                  blurb="The portfolio, the risks, and what needs your decision."
                  graphic={<CeoGraphic />}
                  stats={[
                    { value: wsList.length, label: wsList.length === 1 ? "workspace" : "workspaces" },
                    { value: upcoming.length, label: "meetings ahead" },
                    { value: tasksLoading ? "–" : stats.overdue.length, label: "late tasks", alert: stats.overdue.length > 0 },
                  ]}
                  footer={
                    // Disabled for now: not clickable until the CEO Tower rebuild ships.
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#b9c8be]">
                      <Hammer className="h-3.5 w-3.5" aria-hidden />
                      Coming soon
                    </span>
                  }
                />
              </motion.div>
            )}
          </motion.div>

          {/* ── Attention + brief ─────────────────────────────────────── */}
          <motion.div
            className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]"
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            animate="show"
            transition={{ delay: 0.3 }}
          >
            <section aria-labelledby="att-h" className="ez-glass overflow-hidden rounded-2xl">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-5 pb-3 pt-5 sm:px-6">
                <h2 id="att-h" className="font-serif text-[24px] font-normal leading-none text-foreground">
                  Needs your attention
                </h2>
                {!tasksLoading && (
                  <span className="font-mono text-xs text-[#b45309] dark:text-brass-soft">
                    {stats.attention.length} {stats.attention.length === 1 ? "item" : "items"}
                  </span>
                )}
                <span className="flex-1" />
                <Link href="/dashboard" className="text-[13px] font-semibold text-primary hover:underline">
                  All my work
                </Link>
              </div>

              {tasksLoading ? (
                <div className="flex flex-col gap-2 px-5 pb-5 sm:px-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                  ))}
                </div>
              ) : visibleAttention.length === 0 ? (
                <p className="border-t border-foreground/10 px-6 py-8 text-sm text-muted-foreground">
                  Nothing is overdue or due this week. New assignments will show up here.
                </p>
              ) : (
                <ul>
                  {visibleAttention.map(({ task, kind }) => {
                    const href = boardLink.get(task.boardId);
                    return (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 border-t border-foreground/[0.07] px-5 py-3 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.03] sm:gap-4 sm:px-6"
                      >
                        <span className={cn("hidden w-[78px] shrink-0 rounded-md py-1 text-center text-[11.5px] font-semibold ring-1 sm:block", KIND_META[kind].cls)}>
                          {KIND_META[kind].label}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14px] font-medium text-foreground">{task.name}</span>
                          <span className="truncate text-[12px] text-muted-foreground">
                            <span className={cn("font-semibold sm:hidden", kind === "overdue" && "text-destructive")}>{KIND_META[kind].label} · </span>
                            {task.boardName} · {task.groupName}
                            {task.dueDate ? ` · due ${shortDate(dueDay(task.dueDate))}` : ""}
                          </span>
                        </span>
                        {href && (
                          <Link
                            href={href}
                            className={cn(
                              "shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                              kind === "overdue"
                                ? "bg-forest text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"
                                : "border border-foreground/15 bg-white/50 text-foreground hover:bg-white dark:bg-white/5 dark:hover:bg-white/10",
                            )}
                          >
                            Open
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="brief-h" className="ez-glass-forest relative flex flex-col overflow-hidden rounded-2xl p-5 sm:p-6">
              <svg className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 opacity-40" viewBox="0 0 100 100" fill="none" aria-hidden>
                <circle cx="50" cy="50" r="46" stroke="#d9bd8c" strokeOpacity="0.5" strokeDasharray="2 5" />
                <circle cx="50" cy="50" r="30" stroke="#34d399" strokeOpacity="0.4" />
              </svg>
              <div className="relative flex items-baseline gap-2.5">
                <Sparkles className="h-4 w-4 self-center text-brass-soft" aria-hidden />
                <h2 id="brief-h" className="font-serif text-[24px] font-normal leading-none text-white">
                  Your {getGreeting().split(" ")[1]} brief
                </h2>
                <span className="flex-1" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#b9c8be]">Live</span>
              </div>

              <div className="relative mt-4 space-y-2.5 text-[13.5px] leading-relaxed text-[#dfe8e2]">
                {tasksLoading ? (
                  <p className="text-[#b9c8be]">Reading your boards…</p>
                ) : (
                  brief.map((l) => (
                    <p key={l.lead}>
                      <strong className="font-semibold text-white">{l.lead}</strong> {l.text}
                    </p>
                  ))
                )}
              </div>

              {(answer || asking) && (
                <div className="relative mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3.5 text-[13px] leading-relaxed text-[#e9efe9]" aria-live="polite">
                  {answer || <span className="inline-flex items-center gap-2 text-[#b9c8be]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Thinking…</span>}
                </div>
              )}

              <form
                className="relative mt-auto pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = question.trim();
                  if (!q || asking) return;
                  ask(q);
                  setQuestion("");
                }}
              >
                <label htmlFor="ask-q" className="text-[11.5px] text-[#9fdcc0]">
                  Ask the EZ assistant about your work
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="ask-q"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What should I tackle first?"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-[13.5px] text-white placeholder:text-[#8aa596] focus:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass/25"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || asking}
                    aria-label="Ask"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brass-soft text-[#0b2a1f] transition-colors hover:bg-[#e6cfa4] disabled:opacity-50"
                  >
                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
              </form>
            </section>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
