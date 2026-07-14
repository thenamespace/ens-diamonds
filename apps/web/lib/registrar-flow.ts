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

// Server-side gate for the value co-owners sign: must cover the fresh price,
// not exceed a 30% ceiling (prevents a malicious client draining the Safe via
// gross overpayment), and fit the Safe's balance. Free-instant is always 0.
export function validateSignedValue(
  value: bigint,
  freshTotalPrice: bigint,
  safeBalance: bigint,
  mode: RegistrationMode,
): boolean {
  if (mode === "free-instant") return value === 0n;
  if (value < freshTotalPrice) return false;
  if (value > (freshTotalPrice * 130n) / 100n) return false;
  if (value > safeBalance) return false;
  return true;
}
