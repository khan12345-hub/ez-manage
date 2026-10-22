import { Suspense } from "react";
import { LoginHeroPanel } from "./LoginHeroPanel";
import { LoginForm } from "./LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <LoginHeroPanel />

      {/* Form panel — gradient + glassmorphism */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-14 lg:px-16 bg-gradient-to-br from-slate-50 via-indigo-50/80 to-purple-50/60 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {/* Decorative gradient orb — top right */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full dark:opacity-20"
          style={{ background: "radial-gradient(circle, rgba(99,97,240,0.14) 0%, rgba(99,97,240,0.05) 50%, transparent 75%)" }}
        />
        {/* Decorative gradient orb — bottom left */}
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-[320px] w-[320px] rounded-full dark:opacity-20"
          style={{ background: "radial-gradient(circle, rgba(72,69,228,0.10) 0%, rgba(72,69,228,0.04) 55%, transparent 75%)" }}
        />

        {/* Dark mode toggle — top right */}
        <div className="absolute right-5 top-5 z-10">
          <ThemeToggle />
        </div>

        {/* Glass card wrapping the form */}
        <div
          className="relative z-10 w-full max-w-[460px] rounded-2xl px-8 py-10 bg-white/72 dark:bg-gray-900/85 border border-indigo-100/50 dark:border-white/[0.08]"
          style={{
            backdropFilter: "blur(20px) saturate(1.6)",
            WebkitBackdropFilter: "blur(20px) saturate(1.6)",
            boxShadow:
              "0 4px 32px rgba(99,97,240,0.08), 0 1px 4px rgba(99,97,240,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <Suspense
            fallback={
              <div className="w-full space-y-5">
                <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-60 animate-pulse rounded bg-muted" />
                <div className="mt-8 h-[62px] animate-pulse rounded-xl bg-muted" />
                <div className="h-[62px] animate-pulse rounded-xl bg-muted" />
                <div className="h-[46px] animate-pulse rounded-xl bg-muted" />
                <div className="h-[46px] animate-pulse rounded-xl bg-muted" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
