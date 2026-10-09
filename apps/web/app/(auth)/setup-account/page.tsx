"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/FormInput";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { setUpAccount } from "@/services/auth/auth.api";
import { UserCircle2 } from "lucide-react";

export const setupAccountSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters"),

    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters"),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/, "Must contain a special character"),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type SetupAccountFormValues = z.infer<typeof setupAccountSchema>;

type SetupAccountPayload = Omit<SetupAccountFormValues, "confirmPassword"> & {
  token: string;
};

export default function SetupAccountPage() {
  const form = useForm<SetupAccountFormValues>({
    resolver: zodResolver(setupAccountSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();
  const queryClient = useQueryClient();

  const setupAccountMutation = useMutation({
    mutationFn: (data: SetupAccountPayload) => setUpAccount(data),
    onSuccess: () => {
      toast.success(`Account Setup Completed!`);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/workspace/1");
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to send invitation. Please try again.";
      toast.error(errorMsg);
    },
  });

  const onSubmit = async (values: SetupAccountFormValues) => {
    const { confirmPassword, ...payload } = values;
    setupAccountMutation.mutate({ ...payload, token });
  };

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand mark + heading */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
            <UserCircle2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up your account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Complete your profile and create a password
          </p>
        </div>

        {/* Steps indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-indigo-500" />
          <div className="h-1.5 w-8 rounded-full bg-indigo-500" />
          <div className="h-1.5 w-8 rounded-full bg-muted" />
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-background px-6 py-7 shadow-xl shadow-black/5 dark:shadow-black/30">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormInput name="firstName" label="First name" />
                <FormInput name="lastName" label="Last name" />
              </div>

              <FormInput name="password" label="Password" type="password" />

              <div>
                <FormInput name="confirmPassword" label="Confirm password" type="password" />
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  Min. 8 chars · uppercase · lowercase · number
                </p>
              </div>

              <Button
                type="submit"
                loading={setupAccountMutation.isPending}
                className="mt-2 h-10 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Create account
              </Button>
            </form>
          </FormProvider>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Your account is linked to your invitation email
        </p>
      </div>
    </div>
  );
}
