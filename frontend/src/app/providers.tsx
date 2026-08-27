"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { AuthGate } from "@/components/auth/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { useSocket } from "@/hooks/useSocket";
import { useWebPush } from "@/hooks/useWebPush";

function SocketBridge() {
  useSocket();
  useWebPush();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SocketBridge />
        <AuthGate>{children}</AuthGate>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
