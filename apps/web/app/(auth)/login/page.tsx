import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-3xl" />
      </div>
      <Suspense fallback={<div className="h-80 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
