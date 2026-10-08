// app/(auth)/layout.tsx
// AuthProvider is already mounted in the root providers.tsx — do NOT nest another one here.

import { GuestWrapper } from "@/app/(auth)/GuestWrapper";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestWrapper>{children}</GuestWrapper>;
}
