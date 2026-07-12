import type { PremiumEntry } from "./ens-premium";

export type Sort = "newest" | "trending" | "ending" | "shortest";

export const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "trending", label: "Trending" },
  { key: "ending", label: "Ending soon" },
  { key: "shortest", label: "Shortest" },
];

export function isSort(v: unknown): v is Sort {
  return typeof v === "string" && SORTS.some((s) => s.key === v);
}

// newest = most recently expired (priciest); ending = nearest the end of the
// 21-day premium (cheapest); shortest = fewest letters. Trending is ordered by
// live watcher counts server-side (see lib/discover-feed), so within the loaded
// set it falls back to newest here.
export function sortEntries(entries: PremiumEntry[], sort: Sort): PremiumEntry[] {
  const a = [...entries];
  switch (sort) {
    case "ending":
      return a.sort((x, y) => x.premiumEndsAt - y.premiumEndsAt);
    case "shortest":
      return a.sort((x, y) => x.letters - y.letters || x.priceEth - y.priceEth);
    case "newest":
    case "trending":
      return a.sort((x, y) => y.expiryDate - x.expiryDate);
  }
}
