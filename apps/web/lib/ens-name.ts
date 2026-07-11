import { normalize } from "viem/ens";
import { formatEther } from "viem";
import { getPrice, getExpiry } from "@ensdomains/ensjs/public";
import { ensClient, getEthUsd, ONE_YEAR } from "./ens-client";

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

// Pure status derivation from expiry vs now (unix seconds). `gracePeriod` is the
// real registrar grace (from ensjs), defaulting to 90d. expiry === 0 (never
// registered) falls through to "available".
export function deriveStatus(
  expiry: number,
  now: number,
  gracePeriod: number = GRACE,
): "active" | "grace" | "premium" | "available" {
  if (expiry > now) return "active";
  if (now < expiry + gracePeriod) return "grace";
  if (now < expiry + gracePeriod + PREMIUM) return "premium";
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

// Read real mainnet ENS status + price for a label via ensjs. Throws on RPC
// failure of the core reads (caller renders an error state). Returns a stub (no
// reads) for invalid or too-short labels. ETH/USD degrades to null on oracle
// failure rather than failing the page.
export async function getEnsNameData(rawLabel: string): Promise<EnsNameData> {
  const stripped = rawLabel.replace(/\.eth$/i, "");
  let normalized: string;
  try {
    normalized = normalize(stripped);
  } catch {
    return stub(rawLabel, "", "invalid");
  }
  if (normalized.length < 3) return stub(rawLabel, normalized, "tooShort");

  const name = `${normalized}.eth`;
  const [price, expiryData] = await Promise.all([
    getPrice(ensClient, { nameOrNames: name, duration: ONE_YEAR }),
    getExpiry(ensClient, { name }),
  ]);
  const ethUsd = await getEthUsd();

  // getExpiry returns null for a never-registered name.
  const expiry = expiryData ? Number(expiryData.expiry.value) : 0;
  const gracePeriod = expiryData ? expiryData.gracePeriod : GRACE;
  const now = Math.floor(Date.now() / 1000);
  const status = deriveStatus(expiry, now, gracePeriod);
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
