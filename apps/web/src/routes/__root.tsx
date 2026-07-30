import { QueryClientProvider } from "@tanstack/react-query";

import "../styles.css";
import "@rainbow-me/rainbowkit/styles.css";

import { Outlet, createRootRoute } from "@tanstack/react-router";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";

import { queryClient } from "@/lib/query";
import { wagmiConfig } from "@/lib/wagmi";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Outlet />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
