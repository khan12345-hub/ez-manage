"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, ArrowRight } from "lucide-react";
import { Button } from "components/ui/button";
import { recoverWithKey } from "@/services/auth/auth.api";
import { cn } from "@/lib/utils";

export default function RecoverPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const recover = useMutation({
    mutationFn: () => recoverWithKey({ email: email.trim(), recoveryKey: key.trim(), password }),
    onSuccess: () => { toast.success("Password reset. Sign in with your new password."); router.push(`/login?email=${encodeURIComponent(email.trim())}`); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Couldn't recover the account."),
  });

  const strong = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  const ready = !!email.trim() && key.trim().length >= 12 && strong && password === confirm;
  const box = "flex h-12 items-center rounded-lg border bg-card px-3.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex flex-col gap-2">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest/10 text-forest dark:bg-primary/15 dark:text-primary"><KeyRound className="h-5 w-5" /></span>
        <h1 className="font-serif text-[34px] font-normal leading-[1.05] text-foreground">Use your Account Kit</h1>
        <p className="text-[15px] text-muted-foreground">Enter your email and the Account Recovery Key we emailed you at sign-up to set a new password.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (ready) recover.mutate(); }} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-foreground/85">Email address</label>
          <div className={box}><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@company.com" className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60" /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-foreground/85">Account Recovery Key</label>
          <div className={box}><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="EZ1-XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="off" spellCheck={false} className="w-full bg-transparent font-mono text-[14px] tracking-[0.06em] text-foreground outline-none placeholder:tracking-normal placeholder:text-muted-foreground/60" /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-foreground/85">New password</label>
          <div className={box}><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full bg-transparent text-[15px] text-foreground outline-none" /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-foreground/85">Confirm password</label>
          <div className={box}><input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" className="w-full bg-transparent text-[15px] text-foreground outline-none" /></div>
          <p className="text-[11px] text-muted-foreground/70">Min. 8 chars · uppercase · lowercase · number</p>
        </div>

        <Button type="submit" loading={recover.isPending} disabled={!ready} className="mt-1 h-[50px] w-full rounded-lg border-0 bg-forest text-[15px] font-semibold text-white hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
          Reset password <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Link href="/login" className="text-center text-[13px] text-muted-foreground hover:text-foreground">Back to sign in</Link>
      </form>
    </div>
  );
}
