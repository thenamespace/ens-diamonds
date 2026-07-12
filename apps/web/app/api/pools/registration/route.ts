import { encodeFunctionData } from "viem";
import { getSession } from "@/lib/session";
import { getPool, isContributor, sepoliaClient } from "@/lib/sepolia-client";
import { getCommit, saveCommit, getSignatures, clearSignatures } from "@/lib/pool-registration";
import { controllerAbi, buildRegistration, ENS_CONTROLLER, ONE_YEAR } from "@/lib/ens-registrar";
import { buildCallSafeTx, safeAbi, safeTxHash } from "@/lib/safe";
import { CHAIN } from "@/lib/chain";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";
const noStore = { "cache-control": "no-store" };

// Build the register Safe-tx (to/value/data/nonce/safeTxHash) from a commit record.
// Uses pinned (value,nonce) if set, else fresh price + current nonce. Returns the
// value/nonce as strings for JSON.
async function buildRegisterTx(safe: string, label: string, secret: `0x${string}`, pinnedValue?: string, pinnedNonce?: string) {
  const reg = buildRegistration(label, safe as `0x${string}`, secret);
  const data = encodeFunctionData({ abi: controllerAbi, functionName: "register", args: [reg] });
  const nonce =
    pinnedNonce !== undefined
      ? BigInt(pinnedNonce)
      : ((await sepoliaClient.readContract({ address: safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint);
  let value: bigint;
  if (pinnedValue !== undefined) value = BigInt(pinnedValue);
  else {
    const price = (await sepoliaClient.readContract({
      address: ENS_CONTROLLER,
      abi: controllerAbi,
      functionName: "rentPrice",
      args: [label, ONE_YEAR],
    })) as { base: bigint; premium: bigint };
    value = price.base + price.premium;
  }
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
    return Response.json({ ...base, safe: null, available: null, commit: null, registerTx: null, signatures: [] }, { headers: noStore });
  }

  let available: boolean | null = null;
  try {
    available = (await sepoliaClient.readContract({
      address: ENS_CONTROLLER,
      abi: controllerAbi,
      functionName: "available",
      args: [pool.label],
    })) as boolean;
  } catch {
    /* leave null */
  }

  let commit = await getCommit(poolId);
  let registerTx: { to: string; value: string; data: string; nonce: string; safeTxHash: string } | null = null;

  if (commit && available !== false) {
    // Self-heal: if pinned params reference a stale Safe nonce, drop them + signatures.
    if (commit.regNonce !== undefined) {
      const cur = (await sepoliaClient.readContract({ address: pool.safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint;
      if (BigInt(commit.regNonce) !== cur) {
        await clearSignatures(poolId);
        commit = { ...commit, regNonce: undefined, regValue: undefined };
      }
    }
    const t = await buildRegisterTx(pool.safe, pool.label, commit.secret, commit.regValue, commit.regNonce);
    registerTx = { to: t.to, value: t.value.toString(), data: t.data, nonce: t.nonce.toString(), safeTxHash: t.safeTxHash };
  }

  const signatures = commit && available !== false ? await getSignatures(poolId) : [];
  return Response.json(
    { ...base, available, commit: commit ? { committedAt: commit.committedAt } : null, registerTx, signatures },
    { headers: noStore },
  );
}

// Save the commit record (shared secret) — SIWE session + must be a contributor.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.address) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { poolId?: unknown; secret?: unknown; committedAt?: unknown };
  const poolId = body.poolId;
  const secret = body.secret;
  const committedAt = body.committedAt;
  if (
    typeof poolId !== "number" ||
    !Number.isInteger(poolId) ||
    typeof secret !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(secret) ||
    typeof committedAt !== "number"
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const pool = await getPool(poolId);
  if (!pool || !pool.safe || pool.safe === ZERO) return Response.json({ error: "Pool not finalized" }, { status: 404 });
  if (!(await isContributor(poolId, session.address))) return Response.json({ error: "Not a contributor" }, { status: 403 });

  await saveCommit(poolId, { secret, committedAt, safe: pool.safe, label: pool.label });
  return Response.json({ ok: true });
}
