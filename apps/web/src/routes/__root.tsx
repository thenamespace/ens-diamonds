import { QueryClientProvider } from "@tanstack/react-query";

import "../styles.css";
import "@rainbow-me/rainbowkit/styles.css";

import { Outlet, createRootRoute } from "@tanstack/react-router";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { ConvexProvider } from "convex/react";
import { WagmiProvider } from "wagmi";

import { convexClient } from "#/lib/convex";
import { queryClient } from "@/lib/query";
import { wagmiConfig } from "@/lib/wagmi";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ConvexProvider client={convexClient}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">
            <Outlet />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ConvexProvider>
  );
}
