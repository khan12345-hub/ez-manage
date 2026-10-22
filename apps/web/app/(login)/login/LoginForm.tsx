"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginDto } from "@repo/shared";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "components/ui/button";
import { useLogin } from "@/services/auth/auth.hooks";
import Link from "next/link";

export function LoginForm() {
  const loginMutation = useLogin();
  const reduced = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: LoginDto) {
    loginMutation.mutate(values);
  }

  return (
    <motion.div
      className="w-full max-w-[420px]"
      initial={reduced ? undefined : { opacity: 0, y: 18 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.52, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.12 }}
    >
      {/* ── Brand mark ──────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)" }}
        >
          <svg width="18" height="14" viewBox="0 0 20 16" fill="none" aria-hidden="true">
            <rect x="0"  y="0"   width="18" height="2.5" rx="1.25" fill="white" fillOpacity="0.92" />
            <rect x="0"  y="6.5" width="13" height="2.5" rx="1.25" fill="white" fillOpacity="0.70" />
            <rect x="0"  y="13"  width="8"  height="2.5" rx="1.25" fill="white" fillOpacity="0.48" />
          </svg>
        </div>
        <span className="text-[1.0625rem] font-bold tracking-tight text-foreground">EzManage</span>
      </div>

      {/* ── Heading group ────────────────────────────────────────────── */}
      <div className="mb-7">
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary">
          Welcome back
        </p>
        <h1 className="text-[1.875rem] font-bold leading-[1.2] tracking-tight text-foreground">
          Sign in to your<br />
          EzManage workspace
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Access your tasks, projects and team — all in one place.
        </p>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {/* Email field */}
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-colors focus-within:border-primary"
            style={{ borderColor: errors.email ? "hsl(var(--destructive))" : undefined }}
          >
            <Mail
              className="h-4 w-4 shrink-0"
              style={{ color: errors.email ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="login-email" className="block text-[10.5px] font-medium text-muted-foreground">
                Email address
              </label>
              <input
                id="login-email"
                {...register("email")}
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                className="block w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/45"
              />
            </div>
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-colors focus-within:border-primary"
            style={{ borderColor: errors.password ? "hsl(var(--destructive))" : undefined }}
          >
            <Lock
              className="h-4 w-4 shrink-0"
              style={{ color: errors.password ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="login-password" className="block text-[10.5px] font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="login-password"
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                className="block w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/45"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
              aria-label="Remember me"
            />
            <span className="text-sm text-foreground/80">Remember me</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Sign in button */}
        <Button
          loading={loginMutation.isPending}
          type="submit"
          className="mt-1 h-12 w-full rounded-xl text-[0.9375rem] font-semibold transition-opacity hover:opacity-90 border-0"
          style={{
            background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)",
            boxShadow: "0 4px 18px rgba(99,97,240,0.35)",
          }}
        >
          Sign in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>

    </motion.div>
  );
}
