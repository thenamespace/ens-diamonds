import { getKv } from "./kv";

// Coordinates the Safe-executed ENS registration for a finalized pool: the
// pinned SafeTx params (so every owner signs the identical tx) and the
// collected register signatures. No commit secret anymore — Sepolia's
// premigration registrar has no commit-reveal, and the Registration struct is
// deterministic from (label, safe). Server-only — never import from a
// "use client" file.

export type RegParams = {
  regValue: string; // canonical register value (wei, as string) — pinned on first signature
  regNonce: string; // canonical Safe nonce (as string) — pinned on first signature
};

const regKey = (id: number) => `poolreg:${id}`;
const sigKey = (id: number) => `poolsig:${id}`;

export async function getRegParams(id: number): Promise<RegParams | null> {
  // Upstash auto-coerces numeric-looking strings back to numbers on read, so
  // stringify every field we depend on comparing/using as a string.
  const rec = await getKv().hgetall<Record<string, unknown>>(regKey(id));
  if (!rec || rec.regNonce === undefined || rec.regNonce === null) return null;
  return { regValue: String(rec.regValue), regNonce: String(rec.regNonce) };
}

// Pin the canonical (value, nonce) all owners sign — set once, on the first signature.
export async function pinRegisterParams(id: number, value: string, nonce: string): Promise<void> {
  await getKv().hset(regKey(id), { regValue: value, regNonce: nonce });
}

// Drop collected signatures + pinned params (e.g. the Safe nonce advanced → stale).
export async function clearSignatures(id: number): Promise<void> {
  const kv = getKv();
  await Promise.all([kv.del(sigKey(id)), kv.del(regKey(id))]);
}

export async function saveSignature(id: number, signer: string, signature: string): Promise<void> {
  await getKv().hset(sigKey(id), { [signer.toLowerCase()]: signature });
}

export async function getSignatures(id: number): Promise<{ signer: string; signature: string }[]> {
  const rec = await getKv().hgetall<Record<string, unknown>>(sigKey(id));
  if (!rec) return [];
  return Object.entries(rec).map(([signer, signature]) => ({ signer, signature: String(signature) }));
}
