import { cofferEscrowAbi } from "./abi/coffer-escrow";
import { ESCROW_ADDRESS } from "./chain";

export const cofferEscrow = {
  address: ESCROW_ADDRESS,
  abi: cofferEscrowAbi,
} as const;

// PoolStatus enum ordering must match CofferEscrow.PoolStatus.
export const POOL_STATUS = ["funding", "funded", "finalized", "expired"] as const;
export type PoolStatusName = (typeof POOL_STATUS)[number];

export function statusName(n: number): PoolStatusName {
  return POOL_STATUS[n] ?? "funding";
}
