import { AuthWrapper } from "@/app/(auth)/AuthWrapper";
import { AuthProvider } from "@/providers/AuthProvider";
import { AppShell } from "@/app/layouts/AppShell/AppShell";
import { ShortcutsProvider } from "@/providers/ShortcutsProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthWrapper>
        <ShortcutsProvider>
          <AppShell>{children}</AppShell>
        </ShortcutsProvider>
      </AuthWrapper>
    </AuthProvider>
  );
}
