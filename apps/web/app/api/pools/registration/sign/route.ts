import { encodeFunctionData, recoverTypedDataAddress } from "viem";
import { getPool, isSafeOwner, sepoliaClient } from "@/lib/sepolia-client";
import { getRegParams, pinRegisterParams, saveSignature, getSignatures, getCommit } from "@/lib/pool-registration";
import {
  controllerAbi,
  v2ControllerAbi,
  buildRegistration,
  ENS_CONTROLLER,
  ONE_YEAR,
  REGISTRATION_MODE,
  SECRET_RE,
} from "@/lib/ens-registrar";
import { validateSignedValue, commitFreshness } from "@/lib/registrar-flow";
import { SAFE_TX_TYPES, safeAbi, safeTxDomain, buildCallSafeTx } from "@/lib/safe";
import { CHAIN, assertEscrowConfigured } from "@/lib/chain";
import { apiLimiter, clientId } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";

// Collect one owner's signature over the register Safe-tx. The signature itself
// proves ownership (it must recover to an on-chain Safe owner), so no SIWE needed
// here — the sig is self-authenticating. The server rebuilds the exact SafeTx from
// on-chain state so a client can't get a bogus tx signed.
export async function POST(req: Request) {
  if (!(await apiLimiter(clientId(req), "reg-sign"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  assertEscrowConfigured();
  const body = (await req.json().catch(() => ({}))) as {
    poolId?: unknown;
    value?: unknown;
    nonce?: unknown;
    signature?: unknown;
  };
  const poolId = body.poolId;
  const value = body.value;
  const nonce = body.nonce;
  const signature = body.signature;
  if (
    typeof poolId !== "number" ||
    !Number.isInteger(poolId) ||
    typeof value !== "string" ||
    typeof nonce !== "string" ||
    typeof signature !== "string"
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const pool = await getPool(poolId);
  if (!pool || !pool.safe || pool.safe === ZERO) return Response.json({ error: "Pool not finalized" }, { status: 404 });

  // Pinned params are fetched before validation only to pick the right error
  // below (pinned-value-drifted vs client-sent-garbage) — pinning itself still
  // happens strictly AFTER validation passes.
  const params = await getRegParams(poolId);

  // Mode-aware value validation: free-instant must be 0; commit-reveal requires a
  // live ("ready") commit and must cover a freshly-read price without exceeding
  // the Safe's balance.
  let secret: `0x${string}` | undefined;
  if (REGISTRATION_MODE === "free-instant") {
    if (!validateSignedValue(BigInt(value), 0n, 0n, "free-instant")) {
      return Response.json({ error: "Bad value" }, { status: 400 });
    }
  } else {
    const commit = await getCommit(poolId);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!commit || !SECRET_RE.test(commit.secret) || commitFreshness(commit.committedAt, nowSec) !== "ready") {
      return Response.json({ error: "No usable commit", code: "REFRESH" }, { status: 409 });
    }
    secret = commit.secret;
    const price = (await sepoliaClient.readContract({
      address: ENS_CONTROLLER,
      abi: v2ControllerAbi,
      functionName: "rentPrice",
      args: [pool.label, ONE_YEAR],
    })) as { base: bigint; premium: bigint };
    const freshTotal = price.base + price.premium;
    const balance = await sepoliaClient.getBalance({ address: pool.safe as `0x${string}` });
    if (!validateSignedValue(BigInt(value), freshTotal, balance, "commit-reveal")) {
      // With pinned params the value was valid when pinned and the price moved
      // since — tell the client to refetch GET, which self-heals the pin. A bare
      // 400 is reserved for garbage values with nothing pinned.
      if (params) return Response.json({ error: "Price moved, refresh", code: "REFRESH" }, { status: 409 });
      return Response.json({ error: "Bad value" }, { status: 400 });
    }
  }

  // Freshness — the signed nonce must equal the Safe's current nonce.
  const currentNonce = (await sepoliaClient.readContract({
    address: pool.safe as `0x${string}`,
    abi: safeAbi,
    functionName: "nonce",
  })) as bigint;
  if (BigInt(nonce) !== currentNonce) return Response.json({ error: "Stale nonce, refresh", code: "REFRESH" }, { status: 409 });

  // Pin canonical (value, nonce) on the first signature; later signatures must match.
  if (!params) {
    await pinRegisterParams(poolId, value, nonce);
  } else if (params.regValue !== value || params.regNonce !== nonce) {
    return Response.json({ error: "Params changed, refresh", code: "REFRESH" }, { status: 409 });
  }

  // Rebuild the exact SafeTx and recover the signer. Commit-reveal must encode the
  // committed secret into the Registration struct or the on-chain commitment won't
  // match; free-instant has no secret (deterministic from label+owner).
  const reg =
    REGISTRATION_MODE === "commit-reveal"
      ? buildRegistration(pool.label, pool.safe as `0x${string}`, secret as `0x${string}`)
      : buildRegistration(pool.label, pool.safe as `0x${string}`);
  // controllerAbi already dispatches on mode, and both ABIs share the same
  // register(Registration) shape.
  const data = encodeFunctionData({ abi: controllerAbi, functionName: "register", args: [reg] });
  const tx = buildCallSafeTx({ to: ENS_CONTROLLER, value: BigInt(value), data, nonce: BigInt(nonce) });

  let signer: string;
  try {
    signer = await recoverTypedDataAddress({
      domain: safeTxDomain(pool.safe as `0x${string}`, CHAIN.id),
      types: SAFE_TX_TYPES,
      primaryType: "SafeTx",
      message: tx,
      signature: signature as `0x${string}`,
    });
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!(await isSafeOwner(pool.safe, signer))) return Response.json({ error: "Not a Safe owner" }, { status: 403 });

  await saveSignature(poolId, signer, signature);
  const sigs = await getSignatures(poolId);
  return Response.json({ ok: true, signers: sigs.map((s) => s.signer) });
}
