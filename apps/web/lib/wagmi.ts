import { createConfig, http } from "wagmi";
import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet, coinbaseWallet } from "@rainbow-me/rainbowkit/wallets";
import { APP_CHAIN } from "./app-chain";
import { APP_RPC } from "./chain";

// RainbowKit builds the connector list (EIP-6963 discovery + WalletConnect +
// Coinbase) and drives a modal that lists each installed wallet separately,
// so the user explicitly picks MetaMask vs Ambire instead of silently
// binding to whatever claimed `window.ethereum`.
//
// WalletConnect project id (cloud.reown.com). Without it, injected wallets
// still work; WalletConnect (mobile/QR) is simply absent.
//
// IMPORTANT: getDefaultConfig THROWS ("No projectId found") on an empty
// projectId — it can't be used for the WC-less path. So when the id is
// missing we build the config by hand with only the WalletConnect-free
// wallets (injected/EIP-6963 covers MetaMask, Rabby, etc.; Coinbase uses its
// own SDK). This keeps every page working in CI/dev builds that lack the env
// var, exactly as the comment above promises.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const transports = { [APP_CHAIN.chainId]: http(APP_RPC) };

function buildConfig() {
  if (projectId) {
    return getDefaultConfig({
      appName: "Coffer",
      projectId,
      chains: [APP_CHAIN.chain],
      transports,
      ssr: true,
    });
  }

  if (typeof window === "undefined") {
    console.warn(
      "[coffer] NEXT_PUBLIC_WC_PROJECT_ID not set — WalletConnect disabled (injected + Coinbase wallets unaffected)",
    );
  }
  const connectors = connectorsForWallets(
    [{ groupName: "Wallets", wallets: [injectedWallet, coinbaseWallet] }],
    { appName: "Coffer", projectId },
  );
  return createConfig({
    connectors,
    chains: [APP_CHAIN.chain],
    transports,
    ssr: true,
  });
}

export const wagmiConfig = buildConfig();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
