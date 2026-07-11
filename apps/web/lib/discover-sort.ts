import type { PremiumEntry } from "./ens-premium";

export type Sort = "newest" | "ending" | "shortest";

export const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending soon" },
  { key: "shortest", label: "Shortest" },
];

// newest = most recently expired (priciest); ending = nearest the end of the
// 21-day premium (cheapest); shortest = fewest letters.
export function sortEntries(entries: PremiumEntry[], sort: Sort): PremiumEntry[] {
  const a = [...entries];
  switch (sort) {
    case "newest":
      return a.sort((x, y) => y.expiryDate - x.expiryDate);
    case "ending":
      return a.sort((x, y) => x.premiumEndsAt - y.premiumEndsAt);
    case "shortest":
      return a.sort((x, y) => x.letters - y.letters || x.priceEth - y.priceEth);
  }
}
