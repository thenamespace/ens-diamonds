import { createPublicClient, http } from "viem";
import { CHAIN, SEPOLIA_RPC } from "./chain";
import { cofferEscrow } from "./contract";

// Read-only Sepolia client for server routes (verify a pool's on-chain creator).
// Server-only — never import from a "use client" file.
export const sepoliaClient = createPublicClient({ chain: CHAIN, transport: http(SEPOLIA_RPC) });

// Lowercased creator of a pool, or null if out of range / unreadable.
export async function getPoolCreator(poolId: number): Promise<string | null> {
  try {
    const pool = (await sepoliaClient.readContract({
      ...cofferEscrow,
      functionName: "pools",
      args: [BigInt(poolId)],
    })) as readonly unknown[];
    const creator = pool[1] as string; // struct index 1 = creator
    if (!creator || creator === "0x0000000000000000000000000000000000000000") return null;
    return creator.toLowerCase();
  } catch {
    return null;
  }
}
