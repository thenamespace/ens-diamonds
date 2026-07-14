import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { APP_CHAIN } from "./app-chain";
import { APP_RPC } from "./chain";

// RainbowKit builds the connector list (EIP-6963 discovery + WalletConnect +
// Coinbase) and drives a modal that lists each installed wallet separately,
// so the user explicitly picks MetaMask vs Ambire instead of silently
// binding to whatever claimed `window.ethereum`.
//
// projectId enables WalletConnect (mobile/QR). Injected wallets work without
// it; set NEXT_PUBLIC_WC_PROJECT_ID (from https://cloud.reown.com) to enable
// the rest.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "coffer_dev_placeholder";

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
