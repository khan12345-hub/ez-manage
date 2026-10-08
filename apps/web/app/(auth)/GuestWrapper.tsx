"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { FullScreenLoader } from "@/components/ui/Loader";
import { GuestHeader } from "./GuestHeader";
import { GuestFooter } from "./GuestFooter";

export function GuestWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
    // router is intentionally excluded — stable reference but listing it re-fires
    // this effect on navigation and can cause a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <FullScreenLoader />;
  }

  return (
    <>
      <GuestHeader />
      {children}
      <GuestFooter />
    </>
  );
}
