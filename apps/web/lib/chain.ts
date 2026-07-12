import { sepolia } from "wagmi/chains";

export const CHAIN = sepolia;

// Public fallback RPC; override with your own via NEXT_PUBLIC_SEPOLIA_RPC_URL.
export const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const ZERO = "0x0000000000000000000000000000000000000000" as const;

// Deployed CofferEscrow on Sepolia (public address). Baked in as the default so
// the live site works without env config; override via NEXT_PUBLIC_ESCROW_ADDRESS.
const DEFAULT_ESCROW = "0x4D47f73c2b04390cA2eF877c7DA00954399C27EB";

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || DEFAULT_ESCROW) as `0x${string}`;

export const isEscrowConfigured = ESCROW_ADDRESS !== ZERO;

export function shortAddr(a?: string): string {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}
