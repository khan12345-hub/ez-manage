"use client";

import { LockKeyhole } from "lucide-react";
import { FormInput } from "@/components/form/FormInput";

export function PasswordSection() {
  return (
    <section className="rounded-2xl border border-border bg-background shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Password &amp; Security</h3>
            <p className="text-xs text-muted-foreground">Leave blank if you don't want to change your password.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <FormInput name="currentPassword" label="Current password" type="password" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput name="newPassword" label="New password" type="password" />
          <FormInput name="confirmPassword" label="Confirm new password" type="password" />
        </div>
      </div>
    </section>
  );
}
