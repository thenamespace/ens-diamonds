import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { APP_CHAIN } from "./app-chain";
import { APP_RPC } from "./chain";

// RainbowKit builds the connector list (EIP-6963 discovery + WalletConnect +
// Coinbase) and drives a modal that lists each installed wallet separately,
// so the user explicitly picks MetaMask vs Ambire instead of silently
// binding to whatever claimed `window.ethereum`.
//
// WalletConnect project id (cloud.reown.com). Without it, injected wallets
// still work; WalletConnect (mobile/QR) is simply absent — and we skip the
// placeholder that used to spam 403s against WC's APIs.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
if (!projectId && typeof window === "undefined") {
  console.warn("[coffer] NEXT_PUBLIC_WC_PROJECT_ID not set — WalletConnect disabled (injected wallets unaffected)");
}

export const wagmiConfig = getDefaultConfig({
  appName: "Coffer",
  projectId,
  chains: [APP_CHAIN.chain],
  transports: {
    [APP_CHAIN.chainId]: http(APP_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
