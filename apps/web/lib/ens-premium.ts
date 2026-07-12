import { unstable_cache } from "next/cache";
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

export type WindowRow = { label: string; expiryDate: number };

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

// The premium window bounds (registrar expiry 90–111 days ago) for `now`.
function premiumWindow(now: number): { lo: number; hi: number } {
  return { lo: now - (GRACE + PREMIUM), hi: now - GRACE };
}

// Keep only labels that are ≥3 chars and ENS-normalizable, deduped by label.
function toValidRows(regs: Registration[], seen = new Set<string>()): WindowRow[] {
  const rows: WindowRow[] = [];
  for (const r of regs) {
    const name = r.labelName;
    if (!name || name.length < 3 || seen.has(name)) continue;
    try {
      normalize(name);
    } catch {
      continue;
    }
    seen.add(name);
    rows.push({ label: name, expiryDate: Number(r.expiryDate) });
  }
  return rows;
}

async function querySubgraph(url: string, query: string): Promise<Registration[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { registrations?: Registration[] }; errors?: unknown };
  if (json.errors) throw new Error("ENS subgraph query error");
  return json.data?.registrations ?? [];
}

const SKIP_CEILING = 5000; // The Graph rejects skip beyond this

// One page of premium labels ordered directly by the subgraph (expiry desc =
// "newest", asc = "ending soon"). The FAST path: a single request per batch, no
// full-set scan. `skip` is a subgraph row offset; `done` means no more pages.
export async function getPremiumLabelsPage(
  dir: "asc" | "desc",
  skip: number,
  first: number,
): Promise<{ rows: WindowRow[]; done: boolean }> {
  const url = subgraphUrl();
  if (!url) return { rows: [], done: true };
  if (skip >= SKIP_CEILING) return { rows: [], done: true };

  const { lo, hi } = premiumWindow(Math.floor(Date.now() / 1000));
  const query = `{
    registrations(first: ${first}, skip: ${skip}, orderBy: expiryDate, orderDirection: ${dir}, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi}, labelName_not: null }) {
      labelName
      expiryDate
    }
  }`;
  const regs = await querySubgraph(url, query);
  // Advance the cursor by rows CONSUMED (not rows kept) so client-side filtering
  // can't misalign pagination; a batch may render slightly fewer than `first`.
  const done = regs.length < first || skip + first >= SKIP_CEILING;
  return { rows: toValidRows(regs), done };
}

// Names currently in the 21-day temporary premium (registrar expiry 90–111 days
// ago), priced live via ensjs. Returns [] when no Graph key is set. Throws on
// subgraph/pricing failure (the page renders an error state).
export async function getPremiumNames(limit = 24): Promise<PremiumEntry[]> {
  const perEnd = Math.ceil(limit / 2);
  const [desc, asc] = await Promise.all([
    getPremiumLabelsPage("desc", 0, perEnd),
    getPremiumLabelsPage("asc", 0, perEnd),
  ]);
  const valid = mergeWindows(desc.rows, asc.rows, limit);
  return priceLabels(valid);
}

// Live-price a batch of label rows (base + premium, one getPrice RPC each) into
// client-facing PremiumEntry objects. Pricing is the expensive part of the feed,
// so callers pass only the rows they need on-screen right now.
export async function priceLabels(rows: WindowRow[]): Promise<PremiumEntry[]> {
  if (rows.length === 0) return [];
  const [prices, ethUsd] = await Promise.all([
    Promise.all(rows.map((v) => getPrice(ensClient, { nameOrNames: `${v.label}.eth`, duration: ONE_YEAR }))),
    getEthUsd(),
  ]);
  const now = Math.floor(Date.now() / 1000);
  return rows.map((v, i) => {
    const totalWei = prices[i].base + prices[i].premium;
    const { dayIntoPremium, premiumEndsAt } = premiumProgress(v.expiryDate, now);
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

// The COMPLETE set of nameable labels currently in the 21-day premium window,
// unpriced. Keyset-paginated by `id` so we can page past The Graph's skip
// ceiling and collect every match. Only needed for the shortest/trending tabs
// (which must order the whole set); newest/ending use getPremiumLabelsPage.
async function fetchAllPremiumLabels(): Promise<WindowRow[]> {
  const url = subgraphUrl();
  if (!url) return [];

  const { lo, hi } = premiumWindow(Math.floor(Date.now() / 1000));
  const PAGE = 1000;
  const MAX_PAGES = 30; // safety cap (≤30k names) so a huge window can't run away
  const out: WindowRow[] = [];
  const seen = new Set<string>();
  let cursor = "";

  for (let p = 0; p < MAX_PAGES; p++) {
    const query = `{
      registrations(first: ${PAGE}, orderBy: id, orderDirection: asc, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi}, labelName_not: null, id_gt: "${cursor}" }) {
        id
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
    const json = (await res.json()) as {
      data?: { registrations?: (Registration & { id: string })[] };
      errors?: unknown;
    };
    if (json.errors) throw new Error("ENS subgraph query error");
    const regs = json.data?.registrations ?? [];
    out.push(...toValidRows(regs, seen));
    if (regs.length < PAGE) break; // last page
    cursor = regs[regs.length - 1].id;
  }
  return out;
}

// Cache the whole assembled set as one entry so the expensive full scan is paid
// once per window and shared across every request and tab — not re-run on each
// click. Membership only shifts as names cross the 90/111-day expiry boundaries
// (slow), so a 5-minute TTL is safe and keeps the cold-scan hit rare. Prices are
// still fetched fresh per batch, so staleness here doesn't affect displayed ETH.
export const getAllPremiumLabels = unstable_cache(fetchAllPremiumLabels, ["premium-labels-all"], {
  revalidate: 300,
});
