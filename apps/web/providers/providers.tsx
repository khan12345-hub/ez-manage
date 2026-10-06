"use client";

import { ThemeProvider } from "./ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./AuthProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationStreamProvider } from "./NotificationStreamProvider";
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // show cached data for 60s before background refetch
            retry: (failureCount, error: any) => {
              // Never retry on 429 — it only makes rate limiting worse
              const status = error?.status ?? error?.response?.status;
              if (status === 429) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
