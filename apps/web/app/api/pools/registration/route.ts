import { encodeFunctionData, labelhash, namehash } from "viem";
import { getPool, isContributor, readCommitTimestamp, sepoliaClient } from "@/lib/sepolia-client";
import { getSession } from "@/lib/session";
import { getRegParams, getSignatures, clearSignatures, getCommit, saveCommit, clearCommit } from "@/lib/pool-registration";
import {
  controllerAbi,
  v2ControllerAbi,
  baseRegistrarAbi,
  buildRegistration,
  ENS_CONTROLLER,
  ENS_BASE_REGISTRAR,
  ENS_REGISTRY,
  ensRegistryAbi,
  REGISTRATION_MODE,
  ONE_YEAR,
  SECRET_RE,
} from "@/lib/ens-registrar";
import { registerValue, chainCommitFreshness, valueWithinBand } from "@/lib/registrar-flow";
import { buildCallSafeTx, safeAbi, safeTxHash } from "@/lib/safe";
import { CHAIN, assertEscrowConfigured } from "@/lib/chain";
import { apiLimiter, readLimiter, clientId } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";
const noStore = { "cache-control": "no-store" };

type RegisterTx = { to: string; value: string; data: string; nonce: string; safeTxHash: string };

// Build the free-instant register Safe-tx (to/value/data/nonce/safeTxHash). Value
// is always 0 — Sepolia's premigration registrar is free and refunds any ETH sent.
// The Registration struct is deterministic from (label, safe) — no commit secret.
async function buildFreeInstantTx(safe: string, label: string, pinnedNonce?: string): Promise<RegisterTx> {
  const reg = buildRegistration(label, safe as `0x${string}`);
  const data = encodeFunctionData({ abi: controllerAbi, functionName: "register", args: [reg] });
  const nonce =
    pinnedNonce !== undefined
      ? BigInt(pinnedNonce)
      : ((await sepoliaClient.readContract({ address: safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint);
  const value = 0n;
  const tx = buildCallSafeTx({ to: ENS_CONTROLLER, value, data, nonce });
  return { to: ENS_CONTROLLER, value: value.toString(), data, nonce: nonce.toString(), safeTxHash: safeTxHash(safe as `0x${string}`, CHAIN.id, tx) };
}

// Total (base + premium) 1-year rent for a label, freshly read on-chain.
async function readFreshTotal(label: string): Promise<bigint> {
  const price = (await sepoliaClient.readContract({
    address: ENS_CONTROLLER,
    abi: v2ControllerAbi,
    functionName: "rentPrice",
    args: [label, ONE_YEAR],
  })) as { base: bigint; premium: bigint };
  return price.base + price.premium;
}

// Build the commit-reveal register Safe-tx from a live commit. Value is the
// pinned amount when set, else the caller-provided fresh total + drift buffer
// (see registerValue) — the caller reads rentPrice once and shares it with the
// drift heal. The Registration struct must carry the same secret used in
// commit() or the on-chain commitment won't match.
async function buildCommitRevealTx(
  safe: string,
  label: string,
  secret: `0x${string}`,
  freshTotal: bigint,
  pinnedValue?: string,
  pinnedNonce?: string,
): Promise<RegisterTx> {
  const reg = buildRegistration(label, safe as `0x${string}`, secret);
  const data = encodeFunctionData({ abi: v2ControllerAbi, functionName: "register", args: [reg] });
  const nonce =
    pinnedNonce !== undefined
      ? BigInt(pinnedNonce)
      : ((await sepoliaClient.readContract({ address: safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint);
  const value = pinnedValue !== undefined ? BigInt(pinnedValue) : registerValue(freshTotal, "commit-reveal");
  const tx = buildCallSafeTx({ to: ENS_CONTROLLER, value, data, nonce });
  return { to: ENS_CONTROLLER, value: value.toString(), data, nonce: nonce.toString(), safeTxHash: safeTxHash(safe as `0x${string}`, CHAIN.id, tx) };
}

export async function GET(req: Request) {
  if (!(await readLimiter(clientId(req), "registration"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  assertEscrowConfigured();
  const poolId = Number(new URL(req.url).searchParams.get("poolId"));
  if (!Number.isInteger(poolId) || poolId < 0) return Response.json({ error: "Bad poolId" }, { status: 400 });
  const pool = await getPool(poolId);
  if (!pool) return Response.json({ error: "Pool not found" }, { status: 404 });

  const base = { safe: pool.safe, label: pool.label, threshold: pool.threshold, mode: REGISTRATION_MODE };
  if (!pool.safe || pool.safe === ZERO) {
    return Response.json(
      { ...base, safe: null, available: null, nameOwner: null, commit: null, registerTx: null, signatures: [] },
      { headers: noStore },
    );
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

  // Who actually holds the name right now (null while unregistered) — the
  // panel must only claim "your Safe owns it" when this equals the Safe.
  // The REGISTRY owner is authoritative: on post-migration mainnet the base
  // registrar's NFT sits with an ENS custodian contract, so ownerOf() would
  // wrongly report a "sniped by <system contract>" for names the Safe owns.
  let nameOwner: string | null = null;
  if (available === false) {
    try {
      const [registryOwner, registrarOwner] = await Promise.all([
        sepoliaClient
          .readContract({
            address: ENS_REGISTRY,
            abi: ensRegistryAbi,
            functionName: "owner",
            args: [namehash(`${pool.label}.eth`)],
          })
          .catch(() => null),
        sepoliaClient
          .readContract({
            address: ENS_BASE_REGISTRAR,
            abi: baseRegistrarAbi,
            functionName: "ownerOf",
            args: [BigInt(labelhash(pool.label))],
          })
          .catch(() => null),
      ]);
      const reg = registryOwner && registryOwner !== ZERO ? (registryOwner as string) : null;
      nameOwner = reg ?? (registrarOwner as string | null);
    } catch {
      /* leave null */
    }
  }

  if (REGISTRATION_MODE === "free-instant") {
    let registerTx: RegisterTx | null = null;
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
      registerTx = await buildFreeInstantTx(pool.safe, pool.label, params?.regNonce);
    }
    const signatures = available !== false ? await getSignatures(poolId) : [];
    return Response.json({ ...base, available, nameOwner, commit: null, registerTx, signatures }, { headers: noStore });
  }

  // commit-reveal (mainnet)
  let commit = await getCommit(poolId);
  if (commit && !SECRET_RE.test(commit.secret)) {
    // Corrupt KV record — treat as no-commit and drop it.
    await clearCommit(poolId);
    commit = null;
  }

  if (!commit) {
    return Response.json({ ...base, available, nameOwner, commit: null, registerTx: null, signatures: [] }, { headers: noStore });
  }

  // The on-chain commitment timestamp is authoritative for freshness — the
  // client-attested committedAt in KV only bounds cleanup of a commit that
  // never mines. A failed read counts as "not mined yet": never "ready" on a
  // guess (register() would revert CommitmentNotFound/CommitmentTooNew).
  let onchainTs = 0n;
  try {
    onchainTs = await readCommitTimestamp(pool.label, pool.safe as `0x${string}`, commit.secret);
  } catch {
    /* treat as unmined */
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const freshness = chainCommitFreshness(onchainTs, commit.committedAt, nowSec);
  if (freshness === "expired") {
    await clearCommit(poolId);
    await clearSignatures(poolId);
    return Response.json({ ...base, available, nameOwner, commit: null, registerTx: null, signatures: [] }, { headers: noStore });
  }

  // Report the mined timestamp when we have it — the client's countdown then
  // tracks the chain, not the committer's wall clock.
  const committedAt = onchainTs > 0n ? Number(onchainTs) : commit.committedAt;
  if (freshness === "waiting") {
    return Response.json(
      { ...base, available, nameOwner, commit: { committedAt }, registerTx: null, signatures: [] },
      { headers: noStore },
    );
  }

  // Commit is ready — build the register Safe-tx.
  let registerTx: RegisterTx | null = null;
  if (available !== false) {
    // Read the fresh price once — the drift heal and the tx build both need it.
    const freshTotal = await readFreshTotal(pool.label);
    // Self-heal: drop pinned params + signatures if they reference a stale Safe
    // nonce, or a "0" value pinned before a commit existed (invalid in this mode).
    let params = await getRegParams(poolId);
    if (params) {
      const cur = (await sepoliaClient.readContract({ address: pool.safe as `0x${string}`, abi: safeAbi, functionName: "nonce" })) as bigint;
      if (BigInt(params.regNonce) !== cur || params.regValue === "0") {
        await clearSignatures(poolId);
        params = null;
      }
    }
    // Additional heal: pinned value fell out of the fresh price band — stale
    // signatures must be re-collected at a current price.
    if (params && !valueWithinBand(BigInt(params.regValue), freshTotal)) {
      await clearSignatures(poolId);
      params = null;
    }
    registerTx = await buildCommitRevealTx(pool.safe, pool.label, commit.secret, freshTotal, params?.regValue, params?.regNonce);
  }
  const signatures = available !== false ? await getSignatures(poolId) : [];
  return Response.json(
    { ...base, available, nameOwner, commit: { committedAt }, registerTx, signatures },
    { headers: noStore },
  );
}

// Save the commit record (shared secret) for the mainnet commit-reveal flow. SIWE
// session required + must be a contributor. Not applicable on free-instant
// deployments (Sepolia's premigration registrar has no commit step).
export async function POST(req: Request) {
  if (!(await apiLimiter(clientId(req), "reg-commit"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  assertEscrowConfigured();
  if (REGISTRATION_MODE !== "commit-reveal") {
    return Response.json({ error: "Not applicable on this deployment" }, { status: 405 });
  }

  const session = await getSession();
  if (!session.address) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { poolId?: unknown; secret?: unknown; committedAt?: unknown };
  const poolId = body.poolId;
  const secret = body.secret;
  const committedAt = body.committedAt;
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    typeof poolId !== "number" ||
    !Number.isInteger(poolId) ||
    poolId < 0 ||
    typeof secret !== "string" ||
    !SECRET_RE.test(secret) ||
    typeof committedAt !== "number" ||
    !Number.isFinite(committedAt) ||
    Math.abs(nowSec - committedAt) >= 600
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const pool = await getPool(poolId);
  if (!pool || !pool.safe || pool.safe === ZERO) return Response.json({ error: "Pool not finalized" }, { status: 404 });
  if (!(await isContributor(poolId, session.address))) return Response.json({ error: "Not a contributor" }, { status: 403 });

  await saveCommit(poolId, { secret: secret as `0x${string}`, committedAt, safe: pool.safe, label: pool.label });
  return Response.json({ ok: true });
}
