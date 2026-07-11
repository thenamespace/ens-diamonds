import { normalize } from "viem/ens";
import { labelhash, formatEther } from "viem";
import {
  mainnetClient,
  ETH_REGISTRAR_CONTROLLER,
  BASE_REGISTRAR,
  CHAINLINK_ETH_USD,
  controllerAbi,
  registrarAbi,
  chainlinkAbi,
  ONE_YEAR,
} from "./ens-mainnet";

export type EnsStatus = "active" | "grace" | "premium" | "available" | "tooShort" | "invalid";

export type EnsNameData = {
  label: string; // raw input (for display fallback)
  normalized: string; // normalized label, "" if invalid
  letters: number;
  status: EnsStatus;
  expiry: number; // unix seconds, 0 if never registered / n/a
  baseWei: bigint;
  premiumWei: bigint;
  totalWei: bigint;
  ethUsd: number | null;
  buyable: boolean;
};

export const DAY = 86400;
export const GRACE = 90 * DAY;
export const PREMIUM = 21 * DAY;

// Pure status derivation from expiry vs now (unix seconds). expiry === 0 (never
// registered) falls through to "available".
export function deriveStatus(expiry: number, now: number): "active" | "grace" | "premium" | "available" {
  if (expiry > now) return "active";
  if (now < expiry + GRACE) return "grace";
  if (now < expiry + GRACE + PREMIUM) return "premium";
  return "available";
}

export function weiToUsd(wei: bigint, ethUsd: number | null): number | null {
  if (ethUsd === null) return null;
  return Number(formatEther(wei)) * ethUsd;
}

function stub(label: string, normalized: string, status: EnsStatus): EnsNameData {
  return {
    label,
    normalized,
    letters: normalized.length,
    status,
    expiry: 0,
    baseWei: 0n,
    premiumWei: 0n,
    totalWei: 0n,
    ethUsd: null,
    buyable: false,
  };
}

// Read real mainnet ENS status + price for a label. Throws on RPC/multicall
// failure (the caller renders an error state). Returns a stub (no reads) for
// invalid or too-short labels.
export async function getEnsNameData(rawLabel: string): Promise<EnsNameData> {
  const stripped = rawLabel.replace(/\.eth$/i, "");
  let normalized: string;
  try {
    normalized = normalize(stripped);
  } catch {
    return stub(rawLabel, "", "invalid");
  }
  if (normalized.length < 3) return stub(rawLabel, normalized, "tooShort");

  const tokenId = BigInt(labelhash(normalized));
  const [price, expiryRaw] = await mainnetClient.multicall({
    allowFailure: false,
    contracts: [
      { address: ETH_REGISTRAR_CONTROLLER, abi: controllerAbi, functionName: "rentPrice", args: [normalized, ONE_YEAR] },
      { address: BASE_REGISTRAR, abi: registrarAbi, functionName: "nameExpires", args: [tokenId] },
    ],
  });

  // ETH/USD is display-only — degrade to ETH-only (ethUsd null) if the oracle
  // read fails, rather than failing the whole page (spec §6).
  let ethUsd: number | null = null;
  try {
    const [decimals, round] = await mainnetClient.multicall({
      allowFailure: false,
      contracts: [
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" },
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" },
      ],
    });
    ethUsd = Number(round[1]) / 10 ** Number(decimals);
  } catch {
    ethUsd = null;
  }

  const expiry = Number(expiryRaw);
  const now = Math.floor(Date.now() / 1000);
  const status = deriveStatus(expiry, now);
  const baseWei = price.base;
  const premiumWei = price.premium;

  return {
    label: rawLabel,
    normalized,
    letters: normalized.length,
    status,
    expiry,
    baseWei,
    premiumWei,
    totalWei: baseWei + premiumWei,
    ethUsd,
    buyable: status === "premium" || status === "available",
  };
}
