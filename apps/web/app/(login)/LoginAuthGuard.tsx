"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { FullScreenLoader } from "@/components/ui/Loader";

export function LoginAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
    // router intentionally omitted — stable ref, including it re-fires on every navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  if (isLoading) return <FullScreenLoader />;
  if (user) return <FullScreenLoader />;
  return <>{children}</>;
}
