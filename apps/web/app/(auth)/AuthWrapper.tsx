"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { FullScreenLoader } from "@/components/ui/Loader";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
    // router is intentionally excluded — it is stable but listing it can re-fire
    // this effect on every navigation, causing a redirect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return <FullScreenLoader />;
  }

  return children;
}
