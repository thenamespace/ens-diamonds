"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { RouterProvider } from "@thenamespace/uikit/rac";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </RouterProvider>
  );
}
