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
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return null
  }

  return children;
}
