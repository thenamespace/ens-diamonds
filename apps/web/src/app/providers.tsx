"use client";

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import {
  type GetSiweMessageOptions,
  RainbowKitSiweNextAuthProvider,
} from "@rainbow-me/rainbowkit-siwe-next-auth";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
  statement: "Sign in to ENS Diamonds.",
});

type ProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function Providers({ children, session }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <NuqsAdapter>
      <WagmiProvider config={wagmiConfig}>
        <SessionProvider refetchInterval={0} session={session}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
              <RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider>
            </RainbowKitSiweNextAuthProvider>
          </QueryClientProvider>
        </SessionProvider>
      </WagmiProvider>
    </NuqsAdapter>
  );
}
