import { sepolia } from "wagmi/chains";

export const CHAIN = sepolia;

// Public fallback RPC; override with your own via NEXT_PUBLIC_SEPOLIA_RPC_URL.
export const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const ZERO = "0x0000000000000000000000000000000000000000" as const;

// Deployed CofferEscrow on Sepolia (public address). Baked in as the default so
// the live site works without env config; override via NEXT_PUBLIC_ESCROW_ADDRESS.
const DEFAULT_ESCROW = "0x5229b09a1f1EC16E69545bAE19E3b2A453a3Ae39";

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || DEFAULT_ESCROW) as `0x${string}`;

// Block the current escrow was deployed at — bounds the PoolCreated log scan for
// the directory so it never re-reads the whole chain. Update on redeploy.
export const ESCROW_DEPLOY_BLOCK = 11258818n;

export const isEscrowConfigured = ESCROW_ADDRESS !== ZERO;

export function shortAddr(a?: string): string {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}
