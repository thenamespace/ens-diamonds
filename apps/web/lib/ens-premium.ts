import { normalize } from "viem/ens";
import { formatEther } from "viem";
import { getPrice } from "@ensdomains/ensjs/public";
import { ensClient, getEthUsd, ONE_YEAR } from "./ens-client";
import { DAY, GRACE, PREMIUM, weiToUsd } from "./ens-name";

// Client-facing entry — NO bigints (must serialize across the server→client
// boundary into the Discover grid).
export type PremiumEntry = {
  label: string;
  letters: number;
  priceUsd: number | null; // total (base + premium) in USD, null if no ETH/USD
  priceEth: number; // total in ETH
  dayIntoPremium: number; // 0..21
  premiumEndsAt: number; // unix seconds
  expiryDate: number; // registrar expiry (unix seconds) — for the "newest" sort
};

// Pure: where a name sits in its 21-day premium window, from its registrar
// expiry. Released at expiry + grace; premium ends 21 days later.
export function premiumProgress(expiryDate: number, now: number): { dayIntoPremium: number; premiumEndsAt: number } {
  const releasedAt = expiryDate + GRACE;
  const premiumEndsAt = releasedAt + PREMIUM;
  const dayIntoPremium = Math.min(21, Math.max(0, Math.floor((now - releasedAt) / DAY)));
  return { dayIntoPremium, premiumEndsAt };
}

const SUBGRAPH_ID = "5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH";

function subgraphUrl(): string | null {
  const key = process.env.GRAPH_API_KEY;
  if (!key) return null;
  return `https://gateway-arbitrum.network.thegraph.com/api/${key}/subgraphs/id/${SUBGRAPH_ID}`;
}

type Registration = { labelName: string | null; expiryDate: string };

// Names currently in the 21-day temporary premium (registrar expiry 90–111 days
// ago), priced live via ensjs. Returns [] when no Graph key is set. Throws on
// subgraph/pricing failure (the page renders an error state).
export async function getPremiumNames(limit = 24): Promise<PremiumEntry[]> {
  const url = subgraphUrl();
  if (!url) return [];

  const now = Math.floor(Date.now() / 1000);
  const lo = now - (GRACE + PREMIUM); // expiry 111 days ago
  const hi = now - GRACE; // expiry 90 days ago
  const query = `{
    registrations(first: ${limit}, orderBy: expiryDate, orderDirection: desc, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi} }) {
      labelName
      expiryDate
    }
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { registrations?: Registration[] }; errors?: unknown };
  if (json.errors) throw new Error("ENS subgraph query error");

  const regs = json.data?.registrations ?? [];
  const valid: { label: string; expiryDate: number }[] = [];
  for (const r of regs) {
    if (!r.labelName || r.labelName.length < 3) continue;
    try {
      normalize(r.labelName);
    } catch {
      continue;
    }
    valid.push({ label: r.labelName, expiryDate: Number(r.expiryDate) });
  }
  if (valid.length === 0) return [];

  const [prices, ethUsd] = await Promise.all([
    Promise.all(valid.map((v) => getPrice(ensClient, { nameOrNames: `${v.label}.eth`, duration: ONE_YEAR }))),
    getEthUsd(),
  ]);

  const now2 = Math.floor(Date.now() / 1000);
  return valid.map((v, i) => {
    const totalWei = prices[i].base + prices[i].premium;
    const { dayIntoPremium, premiumEndsAt } = premiumProgress(v.expiryDate, now2);
    return {
      label: v.label,
      letters: v.label.length,
      priceUsd: weiToUsd(totalWei, ethUsd),
      priceEth: Number(formatEther(totalWei)),
      dayIntoPremium,
      premiumEndsAt,
      expiryDate: v.expiryDate,
    };
  });
}
