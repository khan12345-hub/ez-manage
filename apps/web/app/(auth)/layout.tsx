// app/(auth)/layout.tsx

import { GuestWrapper } from "@/app/(auth)/GuestWrapper";
import { AuthProvider } from "@/providers/AuthProvider";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <GuestWrapper>{children}</GuestWrapper>
    </AuthProvider>
  );
}
