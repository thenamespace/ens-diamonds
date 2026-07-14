import { mainnet, sepolia } from "viem/chains";
import type { Chain } from "viem";

// Single source of truth for everything that differs between the Sepolia test
// deployment and the mainnet deployment. Selected by NEXT_PUBLIC_APP_CHAIN.
// Addresses were verified ON-CHAIN (controllers() authorization + traced live
// registrations) on 2026-07-14 — see docs/superpowers/plans/2026-07-14-mainnet-production-readiness.md.

export type RegistrationMode = "free-instant" | "commit-reveal";

export type AppChain = {
  key: "sepolia" | "mainnet";
  chain: Chain;
  chainId: number;
  registrationMode: RegistrationMode;
  ensController: `0x${string}`;
  ensBaseRegistrar: `0x${string}`;
  ensResolver: `0x${string}`;
  ensAppUrl: string;
  explorerUrl: string;
  // Human-facing network name for UI copy ("Switch to Sepolia" / "Ethereum").
  label: string;
  // Whether this is a test network — gates "testnet"-specific wording.
  isTestnet: boolean;
  // Safe web app chain prefix (app.safe.global uses sep:/eth: address prefixes).
  safePrefix: string;
};

const SEPOLIA: AppChain = {
  key: "sepolia",
  chain: sepolia,
  chainId: sepolia.id,
  registrationMode: "free-instant",
  ensController: "0xdf60C561Ca35AD3C89D24BbA854654b1c3477078", // TestnetV1PremigrationRegistrar
  ensBaseRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ensResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
  ensAppUrl: "https://sepolia.app.ens.domains",
  explorerUrl: "https://sepolia.etherscan.io",
  label: "Sepolia",
  isTestnet: true,
  safePrefix: "sep",
};

const MAINNET: AppChain = {
  key: "mainnet",
  chain: mainnet,
  chainId: mainnet.id,
  registrationMode: "commit-reveal",
  ensController: "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547", // ETHRegistrarController v2
  ensBaseRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ensResolver: "0xF29100983E058B709F3D539b0c765937B804AC15",
  ensAppUrl: "https://app.ens.domains",
  explorerUrl: "https://etherscan.io",
  label: "Ethereum",
  isTestnet: false,
  safePrefix: "eth",
};

// Deliberately throws on an unknown value (unlike lib/chain.ts's silent
// fallbacks): silently defaulting a money-moving controller address would be
// worse than failing the build. NEXT_PUBLIC_ vars are inlined into client
// bundles at build time — each deployment target must be built separately
// (one build per chain; see docs/RUNBOOK.md).
export function resolveAppChain(raw: string | undefined): AppChain {
  const key = (raw ?? "").trim() || "sepolia";
  if (key === "sepolia") return SEPOLIA;
  if (key === "mainnet") return MAINNET;
  throw new Error(`Unknown NEXT_PUBLIC_APP_CHAIN: ${raw}`);
}

export const APP_CHAIN = resolveAppChain(process.env.NEXT_PUBLIC_APP_CHAIN);
