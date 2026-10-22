"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/services/auth/auth.api";
import Link from "next/link";
import { Suspense } from "react";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/, "Must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password");

  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /[0-9]/.test(password) },
    { label: "One special character", ok: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/.test(password) },
  ];

  const mutation = useMutation({
    mutationFn: (data: FormValues) => resetPassword({ token, password: data.password }),
    onSuccess: () => {
      setDone(true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Reset link is invalid or has expired.";
      toast.error(msg);
    },
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <KeyRound className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Invalid link</h1>
        <p className="text-sm text-muted-foreground">This reset link is missing a token. Please request a new one.</p>
        <Link href="/auth/forgot-password" className="mt-2 text-sm font-medium text-primary hover:underline">
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Password reset!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>
        </div>
        <Button
          className="mt-2 h-11 w-full rounded-xl text-sm font-semibold border-0"
          style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)", boxShadow: "0 4px 18px rgba(99,97,240,0.35)" }}
          onClick={() => router.push("/login")}
        >
          Sign in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Icon + heading */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
          style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)", boxShadow: "0 8px 24px rgba(99,97,240,0.35)" }}
        >
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a strong password to secure your account
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-background px-6 py-7 shadow-xl shadow-black/5 dark:shadow-black/30">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">

          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">New password</label>
            <div
              className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 transition-colors focus-within:border-primary"
              style={{ borderColor: errors.password ? "hsl(var(--destructive))" : undefined }}
            >
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Strength checklist */}
          {password.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {rules.map((r) => (
                <div key={r.label} className={`flex items-center gap-1.5 text-[11px] ${r.ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${r.ok ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                  {r.label}
                </div>
              ))}
            </div>
          )}

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Confirm password</label>
            <div
              className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 transition-colors focus-within:border-primary"
              style={{ borderColor: errors.confirmPassword ? "hsl(var(--destructive))" : undefined }}
            >
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                {...register("confirmPassword")}
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            loading={mutation.isPending}
            className="mt-2 h-11 w-full rounded-xl text-sm font-semibold border-0"
            style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)", boxShadow: "0 4px 18px rgba(99,97,240,0.35)" }}
          >
            Reset password
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
