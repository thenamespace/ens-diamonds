import { formatEther } from "viem";

export const weiToUsd = (value: bigint | undefined, ethUsd: bigint | undefined) => {
  if (value === undefined || ethUsd === undefined) return undefined;

  return (Number(formatEther(value)) * Number(ethUsd)) / 1e8;
};
