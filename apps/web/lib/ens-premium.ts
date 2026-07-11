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

type WindowRow = { label: string; expiryDate: number };

// Merge the newest-first and ending-soon-first halves into one deduped list that
// keeps BOTH extremes when capped: interleave desc/asc so the cap can't drop a
// whole end. Dedupe by label (a name can appear in both halves in a tiny window).
export function mergeWindows(desc: WindowRow[], asc: WindowRow[], limit: number): WindowRow[] {
  const out: WindowRow[] = [];
  const seen = new Set<string>();
  const push = (r: WindowRow | undefined) => {
    if (!r || seen.has(r.label) || out.length >= limit) return;
    seen.add(r.label);
    out.push(r);
  };
  const n = Math.max(desc.length, asc.length);
  for (let i = 0; i < n && out.length < limit; i++) {
    push(desc[i]);
    push(asc[i]);
  }
  return out;
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
  const windowQuery = (dir: "desc" | "asc", first: number) => `{
    registrations(first: ${first}, orderBy: expiryDate, orderDirection: ${dir}, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi}, labelName_not: null }) {
      labelName
      expiryDate
    }
  }`;

  const fetchWindow = async (dir: "desc" | "asc", first: number): Promise<Registration[]> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: windowQuery(dir, first) }),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { registrations?: Registration[] }; errors?: unknown };
    if (json.errors) throw new Error("ENS subgraph query error");
    return json.data?.registrations ?? [];
  };

  const perEnd = Math.ceil(limit / 2);
  const [descRegs, ascRegs] = await Promise.all([fetchWindow("desc", perEnd), fetchWindow("asc", perEnd)]);

  const toRows = (regs: Registration[]): WindowRow[] => {
    const rows: WindowRow[] = [];
    for (const r of regs) {
      if (!r.labelName || r.labelName.length < 3) continue;
      try {
        normalize(r.labelName);
      } catch {
        continue;
      }
      rows.push({ label: r.labelName, expiryDate: Number(r.expiryDate) });
    }
    return rows;
  };

  const valid = mergeWindows(toRows(descRegs), toRows(ascRegs), limit);
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
