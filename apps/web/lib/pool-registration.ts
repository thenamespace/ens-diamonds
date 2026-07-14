import { getKv } from "./kv";
import { APP_CHAIN } from "./app-chain";

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

// Commit record for the mainnet commit-reveal flow: the shared secret any
// contributor committed with, so every owner signs (and the Safe executes)
// the byte-identical Registration struct. Sepolia's free-instant flow never
// writes one.
export type CommitRecord = {
  secret: `0x${string}`;
  committedAt: number;
  safe: string;
  label: string;
};

// Keys are chain-namespaced: the Sepolia and mainnet deployments share one
// Upstash store, and pool ids restart per escrow contract — an unscoped key
// would let one chain's coordination data leak into the other's.
const regKey = (id: number) => `poolreg:${APP_CHAIN.key}:${id}`;
const sigKey = (id: number) => `poolsig:${APP_CHAIN.key}:${id}`;
const commitKey = (id: number) => `poolcommit:${APP_CHAIN.key}:${id}`;

export async function getRegParams(id: number): Promise<RegParams | null> {
  // Upstash auto-coerces numeric-looking strings back to numbers on read, so
  // stringify every field we depend on comparing/using as a string.
  const rec = await getKv().get<Record<string, unknown>>(regKey(id));
  if (!rec || rec.regNonce === undefined || rec.regNonce === null) return null;
  return { regValue: String(rec.regValue), regNonce: String(rec.regNonce) };
}

// Atomically pin the canonical (value, nonce) all owners sign — SET NX, so two
// concurrent first-signers can't both pin (last-write-wins would strand the
// loser's signature over a different safeTxHash). Returns the winning pin —
// callers must check it matches what their signer actually signed. null only
// if the pin vanished under a concurrent clear (treat as "refresh").
export async function pinRegisterParamsIfAbsent(id: number, params: RegParams): Promise<RegParams | null> {
  const created = await getKv().set(regKey(id), params, { nx: true });
  if (created === "OK") return params;
  return getRegParams(id);
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

export async function getCommit(id: number): Promise<CommitRecord | null> {
  // Upstash auto-coerces numeric-looking strings back to numbers on read, so
  // stringify every field we depend on comparing/using as a string.
  const rec = await getKv().hgetall<Record<string, unknown>>(commitKey(id));
  if (!rec || rec.secret === undefined || rec.secret === null) return null;
  return {
    secret: String(rec.secret) as `0x${string}`,
    committedAt: Number(rec.committedAt),
    safe: String(rec.safe),
    label: String(rec.label),
  };
}

// A fresh commit replaces any prior commit + pinned params + signatures.
export async function saveCommit(id: number, rec: CommitRecord): Promise<void> {
  const kv = getKv();
  await clearSignatures(id);
  await kv.del(commitKey(id));
  await kv.hset(commitKey(id), {
    secret: rec.secret,
    committedAt: String(rec.committedAt),
    safe: rec.safe,
    label: rec.label,
  });
}

export async function clearCommit(id: number): Promise<void> {
  await getKv().del(commitKey(id));
}
