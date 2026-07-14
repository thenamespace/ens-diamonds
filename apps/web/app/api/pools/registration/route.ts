import { encodeFunctionData, labelhash } from "viem";
import { getPool, sepoliaClient } from "@/lib/sepolia-client";
import { getRegParams, getSignatures, clearSignatures } from "@/lib/pool-registration";
import { controllerAbi, baseRegistrarAbi, buildRegistration, ENS_CONTROLLER, ENS_BASE_REGISTRAR } from "@/lib/ens-registrar";
import { buildCallSafeTx, safeAbi, safeTxHash } from "@/lib/safe";
import { CHAIN } from "@/lib/chain";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";
const noStore = { "cache-control": "no-store" };

// Build the register Safe-tx (to/value/data/nonce/safeTxHash). Registration on
// Sepolia's premigration registrar is free, so value is always 0; the struct is
// deterministic from (label, safe) — no commit secret involved.
async function buildRegisterTx(safe: string, label: string, pinnedNonce?: string) {
  const reg = buildRegistration(label, safe as `0x${string}`);
  const data = encodeFunctionData({ abi: controllerAbi, functionName: "register", args: [reg] });
  const nonce =
    pinnedNonce !== undefined
      ? BigInt(pinnedNonce)
      : ((await sepoliaClient.readContract({ address: safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint);
  const value = 0n;
  const tx = buildCallSafeTx({ to: ENS_CONTROLLER, value, data, nonce });
  return { to: ENS_CONTROLLER, value, data, nonce, safeTxHash: safeTxHash(safe as `0x${string}`, CHAIN.id, tx) };
}

export async function GET(req: Request) {
  const poolId = Number(new URL(req.url).searchParams.get("poolId"));
  if (!Number.isInteger(poolId) || poolId < 0) return Response.json({ error: "Bad poolId" }, { status: 400 });
  const pool = await getPool(poolId);
  if (!pool) return Response.json({ error: "Pool not found" }, { status: 404 });

  const base = { safe: pool.safe, label: pool.label, threshold: pool.threshold };
  if (!pool.safe || pool.safe === ZERO) {
    return Response.json({ ...base, safe: null, available: null, registerTx: null, signatures: [] }, { headers: noStore });
  }

  let available: boolean | null = null;
  try {
    available = (await sepoliaClient.readContract({
      address: ENS_BASE_REGISTRAR,
      abi: baseRegistrarAbi,
      functionName: "available",
      args: [BigInt(labelhash(pool.label))],
    })) as boolean;
  } catch {
    /* leave null */
  }

  let registerTx: { to: string; value: string; data: string; nonce: string; safeTxHash: string } | null = null;
  if (available !== false) {
    // Self-heal: drop pinned params + signatures if they reference a stale Safe
    // nonce, or a non-zero value pinned by the old (pre-migration) paid flow.
    let params = await getRegParams(poolId);
    if (params) {
      const cur = (await sepoliaClient.readContract({ address: pool.safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint;
      if (BigInt(params.regNonce) !== cur || params.regValue !== "0") {
        await clearSignatures(poolId);
        params = null;
      }
    }
    const t = await buildRegisterTx(pool.safe, pool.label, params?.regNonce);
    registerTx = { to: t.to, value: t.value.toString(), data: t.data, nonce: t.nonce.toString(), safeTxHash: t.safeTxHash };
  }

  const signatures = available !== false ? await getSignatures(poolId) : [];
  return Response.json({ ...base, available, registerTx, signatures }, { headers: noStore });
}
