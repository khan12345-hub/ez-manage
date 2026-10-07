"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginDto } from "@repo/shared";
import { ArrowRight } from "lucide-react";
import { Button } from "components/ui/button";
import { FormInput } from "@/components/form/FormInput";
import { useLogin } from "@/services/auth/auth.hooks";

export function LoginForm() {
  const loginMutation = useLogin();
  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginDto) {
    loginMutation.mutate(values);
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand mark + heading */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <div className="grid h-7 w-7 grid-cols-2 gap-[3px] rotate-45">
            <div className="rounded-[2px] bg-[#FF3D57]" />
            <div className="rounded-[2px] bg-[#00CFF4]" />
            <div className="rounded-[2px] bg-[#FFCB00]" />
            <div className="rounded-[2px] bg-[#00C875]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your EzManage workspace
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-border bg-background px-6 py-7 shadow-xl shadow-black/5 dark:shadow-black/30">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormInput name="email" label="Email address" />
            <FormInput name="password" label="Password" type="password" />

            <Button
              loading={loginMutation.isPending}
              type="submit"
              className="mt-2 h-10 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </FormProvider>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        Use your invitation email to access EzManage
      </p>
    </div>
  );
}
