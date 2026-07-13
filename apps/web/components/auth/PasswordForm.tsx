"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  setupAccountSchema, 
  changePasswordSchema,
  SetupAccountDto,
  ChangePasswordDto
} from "@repo/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/form/FormInput";
import { KeyRound, Eye, EyeOff, Loader2, User, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

interface PasswordFormProps {
  mode: "setup" | "change";
  token?: string;
  email?: string;
  workspaceName?: string;
  onSuccess?: () => void;
}

export function PasswordForm({ mode, token, email, workspaceName, onSuccess }: PasswordFormProps) {
  const router = useRouter();
  const { refetch } = useAuth();
  const [showPasswords, setShowPasswords] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Setup form based on mode
  const form = useForm<any>({
    resolver: zodResolver(mode === "setup" ? setupAccountSchema : changePasswordSchema),
    defaultValues: mode === "setup" 
      ? { token: token || "", firstName: "", lastName: "", password: "", confirmPassword: "" }
      : { currentPassword: "", password: "", confirmPassword: "" },
  });

  const { watch, handleSubmit } = form;
  const password = watch("password") || "";

  // Password criteria checklist for visual feedback
  const criteria = [
    { label: "At least 8 characters", val: password.length >= 8 },
    { label: "At least one uppercase letter", val: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter", val: /[a-z]/.test(password) },
    { label: "At least one number", val: /[0-9]/.test(password) },
    { label: "At least one special character", val: /[^A-Za-z0-9]/.test(password) },
  ];

  async function onSubmit(values: any) {
    setIsPending(true);
    try {
      if (mode === "setup") {
        const response = await api.post("/auth/setup-account", values);
        toast.success("Account setup successful!");
        refetch(); // Invalidate /auth/me state
        router.push("/dashboard");
      } else {
        await api.post("/auth/change-password", values);
        toast.success("Password changed successfully!");
        form.reset();
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "An error occurred. Please try again.";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-primary/5">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {mode === "setup" ? "Set Password" : "Change Password"}
        </h1>
        {mode === "setup" && email && (
          <div className="mt-3 rounded-lg bg-white/5 px-4 py-2 text-sm text-zinc-300">
            Setting up account for <span className="font-semibold text-primary">{email}</span>
            {workspaceName && (
              <span className="block mt-1 text-xs text-zinc-400">
                Workspace: <span className="text-white font-medium">{workspaceName}</span>
              </span>
            )}
          </div>
        )}
        {mode === "change" && (
          <p className="mt-2 text-sm text-zinc-400">
            Update your account password to stay secure.
          </p>
        )}
      </div>

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mode === "setup" && (
            <div className="grid grid-cols-2 gap-4">
              <TextField 
                name="firstName" 
                label="First Name" 
                placeholder="John" 
                className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-primary/50 focus:ring-primary/20"
              />
              <TextField 
                name="lastName" 
                label="Last Name" 
                placeholder="Doe" 
                className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>
          )}

          {mode === "change" && (
            <div className="relative">
              <TextField
                name="currentPassword"
                label="Current Password"
                type={showPasswords ? "text" : "password"}
                placeholder="••••••••"
                className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>
          )}

          <div className="relative">
            <TextField
              name="password"
              label={mode === "setup" ? "Choose Password" : "New Password"}
              type={showPasswords ? "text" : "password"}
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-primary/50 focus:ring-primary/20"
            />
          </div>

          <div className="relative">
            <TextField
              name="confirmPassword"
              label="Confirm Password"
              type={showPasswords ? "text" : "password"}
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-primary/50 focus:ring-primary/20"
            />
          </div>

          {/* Toggle Passwords Visibility */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              {showPasswords ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hide passwords
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Show passwords
                </>
              )}
            </button>
          </div>

          {/* Password Requirements Visualization */}
          {password && (
            <div className="rounded-lg bg-white/5 p-4 space-y-2 border border-white/5">
              <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Password strength:
              </p>
              <div className="grid grid-cols-1 gap-1 text-[11px]">
                {criteria.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div 
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        c.val ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-zinc-600"
                      }`}
                    />
                    <span className={c.val ? "text-emerald-400 font-medium" : "text-zinc-400"}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={isPending}
            className="w-full mt-4 h-11 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-lg font-medium transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {mode === "setup" ? "Complete Setup" : "Change Password"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}
