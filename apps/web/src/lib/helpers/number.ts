import { formatEther, parseEther } from "viem";

export const ETH_INPUT_STEP = 0.00001;

export const weiToEth = (value: bigint) => Number(formatEther(value));

export const parseEth = (value: string) => {
  try {
    return parseEther(value.trim());
  } catch {
    return null;
  }
};

export const parsePositiveEth = (value: string) => {
  const amount = parseEth(value);
  return amount !== null && amount > 0n ? amount : null;
};

export const getMajorityThreshold = (memberCount: number) => Math.floor(memberCount / 2) + 1;
