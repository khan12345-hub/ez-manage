"use client";

import { LockKeyhole } from "lucide-react";

import { FormInput } from "@/components/form/FormInput";

export function PasswordSection() {
  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <LockKeyhole className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold">
              Password & Security
            </h2>

            <p className="text-sm text-muted-foreground">
              Leave these fields empty if you
              don't want to change your
              password.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <FormInput
          name="currentPassword"
          label="Current password"
          type="password"
        />

        <FormInput
          name="newPassword"
          label="New password"
          type="password"
        />

        <FormInput
          name="confirmPassword"
          label="Confirm new password"
          type="password"
        />
      </div>
    </section>
  );
}