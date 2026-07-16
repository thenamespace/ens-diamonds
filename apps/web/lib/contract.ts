import { cofferEscrowAbi } from "./abi/coffer-escrow";
import { ESCROW_ADDRESS } from "./chain";

export const cofferEscrow = {
  address: ESCROW_ADDRESS,
  abi: cofferEscrowAbi,
} as const;

// Must match EnsDiamondsEscrow.EXECUTION_WINDOW (1 days).
export const EXECUTION_WINDOW_SECONDS = 86400;

// PoolStatus enum ordering must match EnsDiamondsEscrow.PoolStatus.
export const POOL_STATUS = ["funding", "funded", "finalized", "expired"] as const;
export type PoolStatusName = (typeof POOL_STATUS)[number];

export function statusName(n: number): PoolStatusName {
  return POOL_STATUS[n] ?? "funding";
}
