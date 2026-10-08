import { AuthWrapper } from "@/app/(auth)/AuthWrapper";
import { AppShell } from "@/app/layouts/AppShell/AppShell";
import { ShortcutsProvider } from "@/providers/ShortcutsProvider";

// AuthProvider is already mounted in the root providers.tsx — do NOT nest another one here.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthWrapper>
      <ShortcutsProvider>
        <AppShell>{children}</AppShell>
      </ShortcutsProvider>
    </AuthWrapper>
  );
}
