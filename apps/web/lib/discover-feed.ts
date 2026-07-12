import "server-only";
import {
  getAllPremiumLabels,
  getPremiumLabelsPage,
  priceLabels,
  type PremiumEntry,
  type WindowRow,
} from "./ens-premium";
import { getTrendingScores } from "./watchlist";
import type { Sort } from "./discover-sort";

// One page of the Discover feed. `entries` are live-priced; `nextOffset` is the
// offset to request for the next batch, or null when the feed is exhausted.
// `total` is the full-set size when known, or null for the fast (paginated) tabs.
export type DiscoverPage = { entries: PremiumEntry[]; nextOffset: number | null; total: number | null };

export const PAGE_SIZE = 24;

// Order the full label set for the tabs that need it. shortest is pure over data
// we already have; trending pulls live watcher counts (watched names first, by
// count desc; everything else keeps a stable newest-first order below them).
async function orderFullSet(rows: WindowRow[], sort: "shortest" | "trending"): Promise<WindowRow[]> {
  const a = [...rows];
  if (sort === "shortest") return a.sort((x, y) => x.label.length - y.label.length || y.expiryDate - x.expiryDate);
  const scores = await getTrendingScores();
  return a.sort((x, y) => (scores.get(y.label) ?? 0) - (scores.get(x.label) ?? 0) || y.expiryDate - x.expiryDate);
}

// A batch of the Discover feed for `sort`, starting at `offset`.
//   • newest / ending → paginated straight from the subgraph (one request, fast)
//   • shortest / trending → order the full (cached) set, then slice
// Either way only PAGE_SIZE names are live-priced per call.
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
  const entries = await priceLabels(slice);
  const next = start + limit;
  return { entries, nextOffset: next < matched.length ? next : null, total: matched.length };
}

export async function getDiscoverPage(sort: Sort, offset: number, limit = PAGE_SIZE): Promise<DiscoverPage> {
  const start = Math.max(0, offset);

  if (sort === "newest" || sort === "ending") {
    const { rows, done } = await getPremiumLabelsPage(sort === "newest" ? "desc" : "asc", start, limit);
    const entries = await priceLabels(rows);
    return { entries, nextOffset: done ? null : start + limit, total: null };
  }

  const ordered = await orderFullSet(await getAllPremiumLabels(), sort);
  const slice = ordered.slice(start, start + limit);
  const entries = await priceLabels(slice);
  const next = start + limit;
  return { entries, nextOffset: next < ordered.length ? next : null, total: ordered.length };
}
