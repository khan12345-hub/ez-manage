"use client";

import { LockKeyhole } from "lucide-react";
import { FormInput } from "@/components/form/FormInput";

export function PasswordSection() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <LockKeyhole className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Password &amp; Security</h3>
            <p className="text-xs text-slate-500">Leave blank if you don't want to change your password.</p>
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
