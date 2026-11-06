import { Suspense } from "react";
import { LoginHeroPanel } from "./LoginHeroPanel";
import { LoginForm } from "./LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

/* Login — "Ledger Reserve" (Phase 0, design option D). */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <LoginHeroPanel />

      <main className="relative flex flex-1 items-center justify-center bg-[#fbfcfa] px-6 py-14 dark:bg-background sm:px-12 lg:px-16 xl:px-24">
        <div className="absolute right-5 top-5 z-10">
          <ThemeToggle />
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-[400px] space-y-5">
              <div className="h-11 w-56 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
              <div className="mt-8 h-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-[50px] animate-pulse rounded-lg bg-muted" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
