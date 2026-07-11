import { describe, it, expect } from "vitest";
import { sortEntries, type Sort } from "./discover-sort";
import type { PremiumEntry } from "./ens-premium";

const e = (label: string, o: Partial<PremiumEntry>): PremiumEntry => ({
  label,
  letters: label.length,
  priceUsd: 0,
  priceEth: 0,
  dayIntoPremium: 0,
  premiumEndsAt: 0,
  expiryDate: 0,
  ...o,
});

const rows: PremiumEntry[] = [
  e("bbbb", { expiryDate: 200, premiumEndsAt: 200, priceEth: 5 }),
  e("aaa", { expiryDate: 300, premiumEndsAt: 300, priceEth: 9 }),
  e("cc c", { expiryDate: 100, premiumEndsAt: 100, priceEth: 1 }),
];

const first = (s: Sort) => sortEntries(rows, s)[0].label;

describe("sortEntries", () => {
  it("newest = highest expiry first", () => expect(first("newest")).toBe("aaa"));
  it("ending = soonest premiumEndsAt first", () => expect(first("ending")).toBe("cc c"));
  it("shortest = fewest letters first", () => expect(first("shortest")).toBe("aaa"));
});
