import { isAddress, getAddress, labelhash } from "viem";
import { sepoliaClient } from "@/lib/sepolia-client";
import { getSoloNames } from "@/lib/portfolio";
import { cofferEscrow } from "@/lib/contract";
import { assertEscrowConfigured } from "@/lib/chain";
import { ENS_BASE_REGISTRAR, baseRegistrarAbi } from "@/lib/ens-registrar";

export const runtime = "nodejs";

const noStore = { "cache-control": "no-store" };
const SCAN_LIMIT = 500; // newest pools considered — bounds the multicall size

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

export type PortfolioSolo = { label: string; expiry: number };
export type PortfolioVault = {
  poolId: number;
  label: string;
  safe: string;
  safeOwns: boolean;
  expiry: number | null;
  yourDeposit: string; // wei
  totalDeposited: string; // wei
  coOwners: { address: string; deposit: string }[];
};

function nameReads(label: string) {
  const id = BigInt(labelhash(label));
  return [
    { address: ENS_BASE_REGISTRAR, abi: baseRegistrarAbi, functionName: "ownerOf" as const, args: [id] },
    { address: ENS_BASE_REGISTRAR, abi: baseRegistrarAbi, functionName: "nameExpires" as const, args: [id] },
  ];
}

// GET /api/portfolio?address=0x… → the wallet's real holdings, verified on-chain:
//  - solo: names it registered through the app AND still owns
//  - vaults: finalized vaults it contributed to (with shares + whether the Safe holds the name)
export async function GET(req: Request) {
  assertEscrowConfigured();
  const raw = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(raw)) return Response.json({ error: "Bad address" }, { status: 400 });
  const address = getAddress(raw);

  // ---- solo names (recorded at buy time, re-verified now) ----
  const soloLabels = await getSoloNames(address);
  const solo: PortfolioSolo[] = [];
  if (soloLabels.length > 0) {
    const reads = await sepoliaClient.multicall({ contracts: soloLabels.flatMap(nameReads) });
    soloLabels.forEach((label, i) => {
      const owner = reads[i * 2];
      const expires = reads[i * 2 + 1];
      if (owner.status === "success" && String(owner.result).toLowerCase() === address.toLowerCase()) {
        solo.push({ label, expiry: expires.status === "success" ? Number(expires.result) : 0 });
      }
    });
  }

  // ---- vault names (finalized pools the wallet contributed to) ----
  const vaults: PortfolioVault[] = [];
  try {
    const poolCount = Number(await sepoliaClient.readContract({ ...cofferEscrow, functionName: "poolCount" }));
    if (poolCount > 0) {
      const from = Math.max(0, poolCount - SCAN_LIMIT);
      const ids = Array.from({ length: poolCount - from }, (_, i) => from + i);

      // pools + my deposit for every candidate id
      const base = await sepoliaClient.multicall({
        contracts: ids.flatMap((id) => [
          { ...cofferEscrow, functionName: "pools" as const, args: [BigInt(id)] },
          { ...cofferEscrow, functionName: "deposits" as const, args: [BigInt(id), address] },
        ]),
      });

      const mine: { id: number; pool: PoolTuple }[] = [];
      ids.forEach((id, i) => {
        const pool = base[i * 2];
        const dep = base[i * 2 + 1];
        if (pool.status !== "success" || dep.status !== "success") return;
        const p = pool.result as unknown as PoolTuple;
        const myDeposit = dep.result as bigint;
        const safe = p[7];
        if (myDeposit > 0n && safe && safe !== "0x0000000000000000000000000000000000000000") mine.push({ id, pool: p });
      });

      for (const { id, pool } of mine) {
        const label = pool[0];
        const safe = pool[7];
        // getContributors returns (addrs[], amounts[]) — shares come for free.
        const [addrs, amounts] = (await sepoliaClient.readContract({
          ...cofferEscrow,
          functionName: "getContributors",
          args: [BigInt(id)],
        })) as readonly [readonly `0x${string}`[], readonly bigint[]];

        const reads = await sepoliaClient.multicall({ contracts: nameReads(label) });

        const coOwners = addrs.map((c, i) => ({ address: c, deposit: (amounts[i] ?? 0n).toString() }));
        const ownerRead = reads[0];
        const expiresRead = reads[1];
        const nameOwner = ownerRead.status === "success" ? String(ownerRead.result).toLowerCase() : null;

        vaults.push({
          poolId: id,
          label,
          safe,
          safeOwns: nameOwner === safe.toLowerCase(),
          expiry: expiresRead.status === "success" ? Number(expiresRead.result) : null,
          yourDeposit: coOwners.find((c) => c.address.toLowerCase() === address.toLowerCase())?.deposit ?? "0",
          totalDeposited: pool[3].toString(),
          coOwners,
        });
      }
    }
  } catch {
    /* escrow unreadable — return solo names only */
  }

  return Response.json({ solo, vaults }, { headers: noStore });
}
