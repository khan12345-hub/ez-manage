"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useCeoAssistantStore } from "@/store/ceo-assistant-store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  LayoutDashboard, Users, Calendar, Shield,
  BrainCircuit, KeyRound, ChevronRight, LayoutGrid, Menu, X, Mail,
} from "lucide-react";

const NAV = [
  { id: "overview",   label: "Dashboard",   icon: LayoutDashboard, desc: "Executive overview" },
  { id: "team",       label: "Team",         icon: Users,           desc: "Team performance"  },
  { id: "management", label: "Management",   icon: Shield,          desc: "Member insights"   },
  { id: "meetings",   label: "Meetings",     icon: Calendar,        desc: "Schedule & agenda" },
  { id: "email",      label: "Email Center", icon: Mail,            desc: "Compose & send"    },
] as const;

interface Props {
  children: React.ReactNode;
  onLock: () => void;
}

export function CeoDashboardShell({ children, onLock }: Props) {
  const { user } = useAuth();
  const { activeSection, setActiveSection } = useCeoAssistantStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeNav = NAV.find((n) => n.id === activeSection) ?? NAV[0];

  const closeSidebar = () => setSidebarOpen(false);

  const handleNavClick = (id: typeof NAV[number]["id"]) => {
    setActiveSection(id);
    closeSidebar();
  };

  return (
    <div className="fixed inset-0 z-[100] flex" style={{ background: "#f8fafc" }}>

      {/* ── Mobile backdrop ──────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[290] bg-black/30 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col bg-white transition-transform duration-300 ease-in-out",
          "fixed inset-y-0 left-0 z-[300] w-64 md:relative md:w-56 md:shrink-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ borderRight: "1px solid #e2e8f0" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)",
              boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
            }}
          >
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">CEO Suite</div>
            <div className="text-sm font-bold text-slate-800 leading-tight">Analytics</div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={closeSidebar}
            className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Main Menu
          </div>
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150",
                  isActive ? "text-indigo-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                style={
                  isActive
                    ? { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }
                    : { border: "1px solid transparent" }
                }
              >
                <Icon className={cn("h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-500"
                )} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="h-3 w-3 text-indigo-400" />}
              </button>
            );
          })}
        </nav>

        {/* User + Actions */}
        <div style={{ borderTop: "1px solid #e2e8f0" }} className="p-3 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 rounded-xl px-2 py-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                style={{ background: "linear-gradient(135deg,#6366f1,#7c3aed)" }}
              >
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-700">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-[10px] text-slate-400">Super Admin</div>
              </div>
            </div>
          )}
          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition-all hover:text-indigo-600 hover:bg-indigo-50"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Task Dashboard
          </Link>
          <button
            onClick={() => { closeSidebar(); onLock(); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition-all hover:text-red-500 hover:bg-red-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Lock Dashboard
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <div
          className="flex shrink-0 items-center gap-3 bg-white px-4 py-3 sm:px-6 sm:py-4"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 sm:text-base truncate">{activeNav.label}</h1>
            <p className="hidden sm:block text-xs mt-0.5 text-slate-400">{activeNav.desc}</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden lg:block text-xs text-slate-400">CEO Executive Dashboard</span>
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#059669",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span className="hidden sm:inline">Live</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#f8fafc" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
