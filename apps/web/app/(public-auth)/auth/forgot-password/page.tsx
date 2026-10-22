"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import Link from "next/link";

const schema = z.object({
  email: z.email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => api.post("/auth/forgot-password", data).then((r) => r.data),
    onSuccess: (_, vars) => {
      setSentEmail(vars.email);
      setSent(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Something went wrong. Please try again.");
    },
  });

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        {sent ? (
          /* ── Success state ───────────────────────────────────────── */
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{sentEmail}</span> has an account,
              we&apos;ve sent a password reset link. Check your inbox and spam folder.
            </p>

            <div className="mt-6 w-full rounded-2xl border border-border bg-background px-6 py-5 shadow-xl shadow-black/5">
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it?{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="font-medium text-primary hover:underline"
                >
                  Try again
                </button>
              </p>
            </div>

            <Link
              href="/login"
              className="mt-5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Form state ──────────────────────────────────────────── */
          <>
            {/* Icon + heading */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)",
                  boxShadow: "0 8px 24px rgba(99,97,240,0.35)",
                }}
              >
                <Mail className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot password?</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            {/* Card */}
            <div className="rounded-2xl border border-border bg-background px-6 py-7 shadow-xl shadow-black/5 dark:shadow-black/30">
              <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Email address</label>
                  <div
                    className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 transition-colors focus-within:border-primary"
                    style={{ borderColor: errors.email ? "hsl(var(--destructive))" : undefined }}
                  >
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  loading={mutation.isPending}
                  className="mt-2 h-11 w-full rounded-xl text-sm font-semibold border-0"
                  style={{
                    background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)",
                    boxShadow: "0 4px 18px rgba(99,97,240,0.35)",
                  }}
                >
                  Send reset link
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>

            <Link
              href="/login"
              className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
