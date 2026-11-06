"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginDto } from "@repo/shared";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "components/ui/button";
import { useLogin } from "@/services/auth/auth.hooks";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* Sign-in form — "Ledger Reserve" (Phase 0). Logic unchanged; layout restyled. */
export function LoginForm() {
  const loginMutation = useLogin();
  const reduced = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: LoginDto) {
    loginMutation.mutate(values);
  }

  const fieldBox =
    "flex h-12 items-center rounded-lg border bg-card px-3.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";

  return (
    <motion.div
      className="w-full max-w-[400px]"
      initial={reduced ? undefined : { opacity: 0, y: 12 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.08 }}
    >
      {/* Brand mark — only on small screens, where the brand panel is hidden */}
      <div className="mb-10 flex items-center gap-3 lg:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-forest font-serif text-lg text-brass-soft">
          EZ
        </span>
        <span className="text-base font-semibold text-foreground">EZ Manage</span>
      </div>

      {/* Heading */}
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="font-serif text-[44px] font-normal leading-[1.05] tracking-normal text-foreground">
          Welcome back
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Sign in to your EZ Manage workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-[13px] font-medium text-foreground/85">
            Email address
          </label>
          <div className={cn(fieldBox, errors.email && "border-destructive")}>
            <input
              id="login-email"
              {...register("email")}
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {errors.email && (
            <p id="login-email-error" className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="login-password" className="text-[13px] font-medium text-foreground/85">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className={cn(fieldBox, "pr-1.5", errors.password && "border-destructive")}>
            <input
              id="login-password"
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me */}
        <label htmlFor="login-remember" className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-foreground/85">
          <input
            id="login-remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-[17px] w-[17px] rounded border-border accent-primary"
          />
          Keep me signed in on this device
        </label>

        {/* Sign in */}
        <Button
          loading={loginMutation.isPending}
          type="submit"
          className="mt-1 h-[50px] w-full rounded-lg border-0 bg-forest text-[15px] font-semibold tracking-[0.01em] text-white hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
        >
          Sign in
          <ArrowRight className="ml-1 h-4 w-4 text-brass-soft dark:text-primary-foreground" />
        </Button>

        <p className="border-t pt-4 text-[13px] leading-relaxed text-muted-foreground">
          New to the team? Ask your workspace admin for an invite. Accounts are
          created by invitation only.
        </p>
      </form>
    </motion.div>
  );
}
