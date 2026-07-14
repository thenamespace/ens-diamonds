import { encodeFunctionData, recoverTypedDataAddress } from "viem";
import { getPool, isSafeOwner, readCommitTimestamp, sepoliaClient } from "@/lib/sepolia-client";
import { getRegParams, pinRegisterParamsIfAbsent, saveSignature, getSignatures, getCommit } from "@/lib/pool-registration";
import {
  controllerAbi,
  v2ControllerAbi,
  buildRegistration,
  ENS_CONTROLLER,
  ONE_YEAR,
  REGISTRATION_MODE,
  SECRET_RE,
} from "@/lib/ens-registrar";
import { validateSignedValue, chainCommitFreshness, isUintString } from "@/lib/registrar-flow";
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
  // value/nonce must be plain uint strings BEFORE any BigInt() below —
  // BigInt("abc") throws (unhandled 500), and hex/whitespace forms would
  // bypass string equality with the pinned params.
  if (
    typeof poolId !== "number" ||
    !Number.isInteger(poolId) ||
    typeof value !== "string" ||
    !isUintString(value) ||
    typeof nonce !== "string" ||
    !isUintString(nonce) ||
    typeof signature !== "string"
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const pool = await getPool(poolId);
  if (!pool || !pool.safe || pool.safe === ZERO) return Response.json({ error: "Pool not finalized" }, { status: 404 });

  // Pinned params are fetched before validation only to pick the right error
  // below (pinned-value-drifted vs client-sent-garbage) — pinning itself
  // happens strictly AFTER the signer is verified as a Safe owner, and
  // atomically (SET NX), so an unauthenticated request can never write the pin
  // and two concurrent first-signers can't both pin.
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
    if (!commit || !SECRET_RE.test(commit.secret)) {
      return Response.json({ error: "No usable commit", code: "REFRESH" }, { status: 409 });
    }
    // Same chain-authoritative gate as GET: the commit must be MINED and aged
    // past minCommitmentAge — a client-attested committedAt can't fake it, so
    // we never store signatures over a registration that would revert. A
    // failed read counts as "not mined yet" (fail closed).
    let onchainTs = 0n;
    try {
      onchainTs = await readCommitTimestamp(pool.label, pool.safe as `0x${string}`, commit.secret);
    } catch {
      /* treat as unmined */
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (chainCommitFreshness(onchainTs, commit.committedAt, nowSec) !== "ready") {
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

  // Later signatures must match the pinned params (the pin itself happens
  // below, only after the signer is verified).
  if (params && (params.regValue !== value || params.regNonce !== nonce)) {
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

  if (!(await isSafeOwner(pool.safe, signer))) {
    // A commit replaced mid-flight (a contributor re-committed while this
    // owner's signature was in transit) rebuilds the tx with the NEW secret,
    // so a genuine owner's signature recovers to a random address. That's
    // stale state, not an auth failure — steer the client to re-collect. A
    // signer who was never valid still gets the plain 403.
    if (REGISTRATION_MODE === "commit-reveal") {
      const commitNow = await getCommit(poolId);
      if (!commitNow || commitNow.secret !== secret) {
        return Response.json({ error: "Commit changed, refresh", code: "REFRESH" }, { status: 409 });
      }
    }
    return Response.json({ error: "Not a Safe owner" }, { status: 403 });
  }

  // Pin the canonical (value, nonce) on the first VERIFIED signature — SET NX,
  // so a concurrent first-signer can't overwrite it. Whoever loses the race
  // must have signed exactly the winning params or their signature is over a
  // different safeTxHash (execTransaction would fail GS026) — refuse it and
  // send them back through GET.
  const pinned = await pinRegisterParamsIfAbsent(poolId, { regValue: value, regNonce: nonce });
  if (!pinned || pinned.regValue !== value || pinned.regNonce !== nonce) {
    return Response.json({ error: "Params changed, refresh", code: "REFRESH" }, { status: 409 });
  }

  await saveSignature(poolId, signer, signature);
  const sigs = await getSignatures(poolId);
  return Response.json({ ok: true, signers: sigs.map((s) => s.signer) });
}
