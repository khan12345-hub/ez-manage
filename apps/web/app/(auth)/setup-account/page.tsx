"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/FormInput";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { setUpAccount } from "@/services/auth/auth.api";
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
      .regex(/[0-9]/, "Must contain a number"),

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
  const router = useRouter()
  const setupAccountMutation = useMutation({
    mutationFn: (data: SetupAccountPayload) => setUpAccount(data),
    onSuccess: () => {
      toast.success(`Account Setup Completed!`);
      router.push("/dashboard")
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

    setupAccountMutation.mutate({
      ...payload,
      token,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-sm border bg-background p-8 shadow-sm">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold">Set up your account</h1>
          <p className="text-sm text-muted-foreground">
            Complete your profile and create a password.
          </p>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormInput name="firstName" label="First Name" />

            <FormInput name="lastName" label="Last Name" />

            <FormInput name="password" label="Password" type="password" />

            <FormInput
              name="confirmPassword"
              label="Confirm Password"
              type="password"
            />

            <Button type="submit" className="w-full">
              Set Up Account
            </Button>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
