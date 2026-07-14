import { encodeFunctionData, recoverTypedDataAddress } from "viem";
import { getPool, isSafeOwner, sepoliaClient } from "@/lib/sepolia-client";
import { getRegParams, pinRegisterParams, saveSignature, getSignatures } from "@/lib/pool-registration";
import { controllerAbi, buildRegistration, ENS_CONTROLLER } from "@/lib/ens-registrar";
import { SAFE_TX_TYPES, safeAbi, safeTxDomain, buildCallSafeTx } from "@/lib/safe";
import { CHAIN, assertEscrowConfigured } from "@/lib/chain";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";

// Collect one owner's signature over the register Safe-tx. The signature itself
// proves ownership (it must recover to an on-chain Safe owner), so no SIWE needed
// here — the sig is self-authenticating. The server rebuilds the exact SafeTx from
// on-chain state so a client can't get a bogus tx signed.
export async function POST(req: Request) {
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

  // Registration is free on Sepolia's premigration registrar — the Safe pays 0.
  if (BigInt(value) !== 0n) return Response.json({ error: "Bad value" }, { status: 400 });

  // Freshness — the signed nonce must equal the Safe's current nonce.
  const currentNonce = (await sepoliaClient.readContract({
    address: pool.safe as `0x${string}`,
    abi: safeAbi,
    functionName: "nonce",
  })) as bigint;
  if (BigInt(nonce) !== currentNonce) return Response.json({ error: "Stale nonce, refresh", code: "REFRESH" }, { status: 409 });

  // Pin canonical (value, nonce) on the first signature; later signatures must match.
  const params = await getRegParams(poolId);
  if (!params) {
    await pinRegisterParams(poolId, value, nonce);
  } else if (params.regValue !== value || params.regNonce !== nonce) {
    return Response.json({ error: "Params changed, refresh", code: "REFRESH" }, { status: 409 });
  }

  // Rebuild the exact SafeTx and recover the signer.
  const reg = buildRegistration(pool.label, pool.safe as `0x${string}`);
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
