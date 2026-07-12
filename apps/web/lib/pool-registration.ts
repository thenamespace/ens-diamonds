import { getKv } from "./kv";

// Coordinates the two-step Safe-executed ENS registration for a finalized pool:
// the commit secret (shared across owners) and the collected register signatures.
// Server-only — never import from a "use client" file.

export type CommitRecord = {
  secret: `0x${string}`;
  committedAt: number;
  safe: string;
  label: string;
  regValue?: string; // canonical register value (wei, as string) — pinned on first signature
  regNonce?: string; // canonical Safe nonce (as string) — pinned on first signature
};

const regKey = (id: number) => `poolreg:${id}`;
const sigKey = (id: number) => `poolsig:${id}`;

export async function getCommit(id: number): Promise<CommitRecord | null> {
  // Upstash auto-coerces numeric-looking strings back to numbers on read, so
  // stringify every field we depend on comparing/using as a string.
  const rec = await getKv().hgetall<Record<string, unknown>>(regKey(id));
  if (!rec || rec.secret === undefined || rec.secret === null) return null;
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
  return {
    secret: str(rec.secret) as `0x${string}`,
    committedAt: Number(rec.committedAt),
    safe: String(rec.safe),
    label: String(rec.label),
    regValue: str(rec.regValue),
    regNonce: str(rec.regNonce),
  };
}

// A fresh commit replaces any prior commit + signatures for the pool.
export async function saveCommit(
  id: number,
  rec: { secret: string; committedAt: number; safe: string; label: string },
): Promise<void> {
  const kv = getKv();
  await Promise.all([kv.del(sigKey(id)), kv.del(regKey(id))]);
  await kv.hset(regKey(id), {
    secret: rec.secret,
    committedAt: String(rec.committedAt),
    safe: rec.safe,
    label: rec.label,
  });
}

// Pin the canonical (value, nonce) all owners sign — set once, on the first signature.
export async function pinRegisterParams(id: number, value: string, nonce: string): Promise<void> {
  await getKv().hset(regKey(id), { regValue: value, regNonce: nonce });
}

// Drop collected signatures + pinned params (e.g. the Safe nonce advanced → stale).
export async function clearSignatures(id: number): Promise<void> {
  const kv = getKv();
  await Promise.all([kv.del(sigKey(id)), kv.hdel(regKey(id), "regValue", "regNonce")]);
}

export async function saveSignature(id: number, signer: string, signature: string): Promise<void> {
  await getKv().hset(sigKey(id), { [signer.toLowerCase()]: signature });
}

export async function getSignatures(id: number): Promise<{ signer: string; signature: string }[]> {
  const rec = await getKv().hgetall<Record<string, unknown>>(sigKey(id));
  if (!rec) return [];
  return Object.entries(rec).map(([signer, signature]) => ({ signer, signature: String(signature) }));
}
