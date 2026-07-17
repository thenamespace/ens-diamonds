import { APP_CHAIN } from "./app-chain";

export const CHAIN = APP_CHAIN.chain;

// Public fallback RPC per chain; override with your own via NEXT_PUBLIC_RPC_URL.
const DEFAULT_PUBLIC_RPC: Record<typeof APP_CHAIN.key, string> = {
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  mainnet: "https://ethereum-rpc.publicnode.com",
};

// Resolve the app RPC. The legacy NEXT_PUBLIC_SEPOLIA_RPC_URL is honored ONLY
// on sepolia builds — a leftover Sepolia RPC must never wire a mainnet build.
export function resolveRpc(
  key: "sepolia" | "mainnet",
  generic: string | undefined,
  legacySepolia: string | undefined,
): string {
  return generic || (key === "sepolia" ? legacySepolia : undefined) || DEFAULT_PUBLIC_RPC[key];
}

export const APP_RPC = resolveRpc(
  APP_CHAIN.key,
  process.env.NEXT_PUBLIC_RPC_URL,
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
);

// Deprecated alias — kept so existing imports keep working. New code should
// import APP_RPC instead.
export const SEPOLIA_RPC = APP_RPC;

export const ZERO = "0x0000000000000000000000000000000000000000" as const;

// Deployed CofferEscrow (public address). Baked in as the default ONLY for
// Sepolia so the live testnet site works without env config; a mainnet build
// MUST get its escrow address from NEXT_PUBLIC_ESCROW_ADDRESS — never fall
// back to the Sepolia deployment.
const DEFAULT_ESCROW = "0x37d1A0Fc5BD9735147cbEe7630C63690C6FDfD6d";

const rawEscrowAddress: string =
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS || (APP_CHAIN.key === "sepolia" ? DEFAULT_ESCROW : "");

export const ESCROW_ADDRESS = rawEscrowAddress as `0x${string}`;

// Block the current escrow was deployed at — bounds the PoolCreated log scan for
// the directory so it never re-reads the whole chain. Update on redeploy.
// Sepolia-only value; currently unconsumed (dead) — make chain-aware or delete
// when first used (Task E1).
export const ESCROW_DEPLOY_BLOCK = 11293050n;

export const isEscrowConfigured = rawEscrowAddress !== "" && ESCROW_ADDRESS !== ZERO;

// Server-side guard: an unconfigured escrow must fail loudly (500), not read
// from address("") and quietly return empty data shaped like "no pools".
export function assertEscrowConfigured(): void {
  if (!isEscrowConfigured) throw new Error("Escrow not configured: set NEXT_PUBLIC_ESCROW_ADDRESS for this deployment");
}

export function shortAddr(a?: string): string {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}
