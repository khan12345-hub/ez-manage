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
  }, [isLoading, user, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return null;
  }

  return (
    <>
      <GuestHeader />
      {children}
      <GuestFooter />
    </>
  );
}
