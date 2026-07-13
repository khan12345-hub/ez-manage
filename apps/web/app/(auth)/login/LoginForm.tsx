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
<div className="w-full max-w-md">
  <div className="mb-8 text-center">
    <h1 className="text-6xl font-semibold">EzManage</h1>

    <h2 className="mt-1 text-4xl font-light">Log In</h2>

    <p className="mt-3 text-sm tracking-[0.4em] uppercase text-muted-foreground">
      MGMT
    </p>
  </div>

  <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormInput name="email" label="Email" />
      <FormInput name="password" label="Password" />

      <Button
       loading={loginMutation.isPending}
       type="submit" className="mt-2 h-12 w-full text-lg">
        Log in
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </form>
  </FormProvider>
</div>
  );
}
