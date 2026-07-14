import { createPublicClient, http } from "viem";
import { unstable_cache } from "next/cache";
import { APP_RPC, CHAIN, assertEscrowConfigured } from "./chain";
import { cofferEscrow } from "./contract";

// Read-only app-chain client for server routes (verify a pool's on-chain creator).
// Server-only — never import from a "use client" file.
export const sepoliaClient = createPublicClient({ chain: CHAIN, transport: http(APP_RPC) });

// Newest pools considered for per-label counts. Bounds the multicall size no
// matter how many pools exist; trending only cares about recent activity.
const COUNT_SCAN_LIMIT = 500;

async function fetchPoolCountsByLabel(): Promise<Record<string, number>> {
  assertEscrowConfigured();
  try {
    // poolCount + pools(id) reads instead of an event scan: public RPCs (the
    // no-config fallback) reject wide eth_getLogs ranges as archive requests.
    const poolCount = Number(await sepoliaClient.readContract({ ...cofferEscrow, functionName: "poolCount" }));
    if (!poolCount) return {};
    const from = Math.max(0, poolCount - COUNT_SCAN_LIMIT);
    const ids = Array.from({ length: poolCount - from }, (_, i) => from + i);
    const results = await sepoliaClient.multicall({
      contracts: ids.map((id) => ({ ...cofferEscrow, functionName: "pools" as const, args: [BigInt(id)] })),
    });
    const counts: Record<string, number> = {};
    for (const r of results) {
      if (r.status !== "success") continue;
      const label = String((r.result as readonly unknown[])[0] ?? "").toLowerCase();
      if (label) counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

// How many pools have been created per label (lowercased), from PoolCreated logs.
// Cached 2m — a plain object (unstable_cache can't serialize a Map). Drives the
// Trending rank + the per-name pool count shown on cards.
export const getPoolCountsByLabel = unstable_cache(fetchPoolCountsByLabel, ["pool-counts-by-label"], {
  revalidate: 120,
});

// Lowercased creator of a pool, or null if out of range / unreadable.
export async function getPoolCreator(poolId: number): Promise<string | null> {
  assertEscrowConfigured();
  const pool = await getPool(poolId);
  return pool ? pool.creator : null;
}

export type OnchainPool = { creator: string; label: string; safe: string; threshold: number };

// Read the on-chain pool struct (addresses lowercased). null if unreadable.
export async function getPool(poolId: number): Promise<OnchainPool | null> {
  assertEscrowConfigured();
  try {
    const p = (await sepoliaClient.readContract({
      ...cofferEscrow,
      functionName: "pools",
      args: [BigInt(poolId)],
    })) as readonly unknown[];
    // [label, creator, targetAmount, totalDeposited, fundingDeadline, fundedAt, threshold, safe]
    const creator = (p[1] as string) ?? "";
    if (!creator || creator === "0x0000000000000000000000000000000000000000") return null;
    return {
      creator: creator.toLowerCase(),
      label: p[0] as string,
      safe: ((p[7] as string) ?? "").toLowerCase(),
      threshold: Number(p[6]),
    };
  } catch {
    return null;
  }
}

// True if `addr` has a non-zero deposit in the pool (i.e. is a contributor).
export async function isContributor(poolId: number, addr: string): Promise<boolean> {
  assertEscrowConfigured();
  try {
    const dep = (await sepoliaClient.readContract({
      ...cofferEscrow,
      functionName: "deposits",
      args: [BigInt(poolId), addr as `0x${string}`],
    })) as bigint;
    return dep > 0n;
  } catch {
    return false;
  }
}

// True if `addr` is an owner of the Safe (used to validate register signatures).
export async function isSafeOwner(safe: string, addr: string): Promise<boolean> {
  try {
    return (await sepoliaClient.readContract({
      address: safe as `0x${string}`,
      abi: [
        {
          type: "function",
          name: "isOwner",
          stateMutability: "view",
          inputs: [{ name: "owner", type: "address" }],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "isOwner",
      args: [addr as `0x${string}`],
    })) as boolean;
  } catch {
    return false;
  }
}
