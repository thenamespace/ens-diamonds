import "server-only";
import {
  getAllPremiumLabels,
  getPremiumLabelsPage,
  priceLabels,
  type PremiumEntry,
  type WindowRow,
} from "./ens-premium";
import { getTrendingScores } from "./watchlist";
import { getPoolCountsByLabel } from "./sepolia-client";
import type { Sort } from "./discover-sort";

// One page of the Discover feed. `entries` are live-priced; `nextOffset` is the
// offset to request for the next batch, or null when the feed is exhausted.
// `total` is the full-set size when known, or null for the fast (paginated) tabs.
export type DiscoverPage = { entries: PremiumEntry[]; nextOffset: number | null; total: number | null };

export const PAGE_SIZE = 24;

// A pool is a much stronger intent signal than a bookmark, so it's worth several
// watches in the Trending rank: score = watchers + pools × TREND_POOL_WEIGHT.
const TREND_POOL_WEIGHT = 4;

// The two live engagement signals, fetched once per feed request.
type Signals = { watchers: Map<string, number>; pools: Record<string, number> };

async function getSignals(): Promise<Signals> {
  const [watchers, pools] = await Promise.all([getTrendingScores(), getPoolCountsByLabel()]);
  return { watchers, pools };
}

function watchersOf(label: string, s: Signals): number {
  return s.watchers.get(label) ?? 0;
}
function poolsOf(label: string, s: Signals): number {
  return s.pools[label.toLowerCase()] ?? 0;
}
function trendingScore(label: string, s: Signals): number {
  return watchersOf(label, s) + poolsOf(label, s) * TREND_POOL_WEIGHT;
}

// Attach the per-name engagement counts to priced entries for display.
function attachSignals(entries: PremiumEntry[], s: Signals): PremiumEntry[] {
  return entries.map((e) => ({ ...e, watchers: watchersOf(e.label, s), pools: poolsOf(e.label, s) }));
}

// Order the full label set for the tabs that need it. shortest is pure over data
// we already have; trending ranks by the combined watchers + pools score (most
// engaged first), keeping newest-first as the tiebreak below.
function orderFullSet(rows: WindowRow[], sort: "shortest" | "trending", s: Signals): WindowRow[] {
  const a = [...rows];
  if (sort === "shortest") return a.sort((x, y) => x.label.length - y.label.length || y.expiryDate - x.expiryDate);
  return a.sort((x, y) => trendingScore(y.label, s) - trendingScore(x.label, s) || y.expiryDate - x.expiryDate);
}

// Search the ENTIRE premium set (the cached full label list) for names
// containing `q`, ranked by relevance: prefix matches first, then shorter names,
// then most-recently-released. Paginated + priced like any other feed page.
export async function searchDiscoverPage(q: string, offset: number, limit = PAGE_SIZE): Promise<DiscoverPage> {
  const norm = q.trim().toLowerCase();
  if (norm.length < 2) return { entries: [], nextOffset: null, total: 0 };

  const rows = await getAllPremiumLabels();
  const matched = rows.filter((r) => r.label.toLowerCase().includes(norm));
  matched.sort((a, b) => {
    const ap = a.label.toLowerCase().startsWith(norm) ? 0 : 1;
    const bp = b.label.toLowerCase().startsWith(norm) ? 0 : 1;
    return ap - bp || a.label.length - b.label.length || b.expiryDate - a.expiryDate;
  });

  const start = Math.max(0, offset);
  const slice = matched.slice(start, start + limit);
  const [priced, signals] = await Promise.all([priceLabels(slice), getSignals()]);
  const next = start + limit;
  return { entries: attachSignals(priced, signals), nextOffset: next < matched.length ? next : null, total: matched.length };
}

// A batch of the Discover feed for `sort`, starting at `offset`.
//   • newest / ending → paginated straight from the subgraph (one request, fast)
//   • shortest / trending → order the full (cached) set, then slice
// Either way only PAGE_SIZE names are live-priced per call, then enriched with
// watcher + pool counts for display.
export async function getDiscoverPage(sort: Sort, offset: number, limit = PAGE_SIZE): Promise<DiscoverPage> {
  const start = Math.max(0, offset);

  if (sort === "newest" || sort === "ending") {
    const { rows, done } = await getPremiumLabelsPage(sort === "newest" ? "desc" : "asc", start, limit);
    const [priced, signals] = await Promise.all([priceLabels(rows), getSignals()]);
    return { entries: attachSignals(priced, signals), nextOffset: done ? null : start + limit, total: null };
  }

  const [rows, signals] = await Promise.all([getAllPremiumLabels(), getSignals()]);
  const ordered = orderFullSet(rows, sort, signals);
  const slice = ordered.slice(start, start + limit);
  const entries = attachSignals(await priceLabels(slice), signals);
  const next = start + limit;
  return { entries, nextOffset: next < ordered.length ? next : null, total: ordered.length };
}

// Engagement counts for a single name (for the name detail page).
export async function getNameSignals(label: string): Promise<{ watchers: number; pools: number }> {
  const s = await getSignals();
  return { watchers: watchersOf(label, s), pools: poolsOf(label, s) };
}
