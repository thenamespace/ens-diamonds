import type { RegistrationMode } from "./app-chain";
import { MIN_COMMIT_WAIT, MAX_COMMIT_AGE } from "./ens-registrar";

// Value to send with register(): fresh on-chain price + 10% drift buffer.
// The ENS controller refunds any excess in the same transaction, so the buffer
// can only be temporarily locked, never lost. Free-instant registrars take 0.
export function registerValue(totalPrice: bigint, mode: RegistrationMode): bigint {
  return mode === "commit-reveal" ? (totalPrice * 110n) / 100n : 0n;
}

export type CommitFreshness = "waiting" | "ready" | "expired";
// On-chain: too-new reverts while commitment+minAge > now (age 60 passes);
// too-old reverts once commitment+maxAge <= now (age 86400 already reverts).
export function commitFreshness(committedAt: number, now: number): CommitFreshness {
  const age = now - committedAt;
  if (age >= MAX_COMMIT_AGE) return "expired";
  if (age < MIN_COMMIT_WAIT) return "waiting";
  return "ready";
}

// Freshness with the on-chain commitment timestamp as the source of truth
// (commit-reveal only). `onchainTs` is the controller's commitments(hash) read:
// the mined commit's block timestamp, or 0 when nothing is committed. A
// client-attested committedAt can't fake "ready" — an unmined commit stays
// "waiting" (register() would revert CommitmentNotFound/TooNew), and the KV
// committedAt only bounds cleanup of a commit that never mines.
export function chainCommitFreshness(onchainTs: bigint, kvCommittedAt: number, now: number): CommitFreshness {
  if (onchainTs > 0n) return commitFreshness(Number(onchainTs), now);
  return commitFreshness(kvCommittedAt, now) === "expired" ? "expired" : "waiting";
}

// Client-sent wei/nonce strings must be plain base-10 unsigned integers before
// they hit BigInt(): BigInt("abc") throws (unhandled 500), and BigInt also
// accepts hex/whitespace/"" that would bypass string equality with pinned
// params. 78 digits bounds uint256.
export function isUintString(s: string): boolean {
  return /^\d{1,78}$/.test(s);
}

// A signable value must cover the fresh price but stay within a 30% ceiling
// (prevents a malicious client draining the Safe via gross overpayment).
// Shared by sign-time validation and the GET route's pinned-value drift heal.
export function valueWithinBand(value: bigint, freshTotalPrice: bigint): boolean {
  return value >= freshTotalPrice && value <= (freshTotalPrice * 130n) / 100n;
}

// Server-side gate for the value co-owners sign: must sit in the fresh price
// band (see valueWithinBand) and fit the Safe's balance. Free-instant is
// always 0.
export function validateSignedValue(
  value: bigint,
  freshTotalPrice: bigint,
  safeBalance: bigint,
  mode: RegistrationMode,
): boolean {
  if (mode === "free-instant") return value === 0n;
  if (!valueWithinBand(value, freshTotalPrice)) return false;
  if (value > safeBalance) return false;
  return true;
}
