// app/(dashboard)/layout.tsx

import { AuthWrapper } from "@/app/(auth)/AuthWrapper";
import { AuthProvider } from "@/providers/AuthProvider";
import { AppShell } from "@/app/layouts/AppShell/AppShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthWrapper>
        <AppShell>
          {children}
        </AppShell>
      </AuthWrapper>
    </AuthProvider>
  );
}

