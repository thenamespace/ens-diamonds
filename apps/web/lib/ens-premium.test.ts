import { describe, it, expect } from "vitest";
import { premiumProgress, mergeWindows } from "./ens-premium";

const DAY = 86400;
const GRACE = 90 * DAY;
const PREMIUM = 21 * DAY;
const now = 1_000_000_000;

describe("premiumProgress", () => {
  it("day 0 the moment the name is released (expiry + grace = now)", () => {
    const r = premiumProgress(now - GRACE, now);
    expect(r.dayIntoPremium).toBe(0);
    expect(r.premiumEndsAt).toBe(now - GRACE + GRACE + PREMIUM);
  });
  it("counts whole days into the premium window", () => {
    expect(premiumProgress(now - GRACE - 5 * DAY, now).dayIntoPremium).toBe(5);
  });
  it("clamps to 21 past the end of the window", () => {
    expect(premiumProgress(now - GRACE - 30 * DAY, now).dayIntoPremium).toBe(21);
  });
  it("clamps to 0 before release (still in grace)", () => {
    expect(premiumProgress(now - GRACE + 5 * DAY, now).dayIntoPremium).toBe(0);
  });
});

describe("mergeWindows", () => {
  const mk = (label: string, expiryDate: number) => ({ label, expiryDate });

  it("dedupes by label and caps to limit", () => {
    const desc = [mk("aaa", 300), mk("bbb", 200)];
    const asc = [mk("ccc", 100), mk("bbb", 200)]; // bbb overlaps
    const out = mergeWindows(desc, asc, 10);
    const labels = out.map((v) => v.label).sort();
    expect(labels).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("keeps both extremes when capped (highest and lowest expiry survive)", () => {
    const desc = [mk("new1", 999), mk("new2", 998)];
    const asc = [mk("old1", 1), mk("old2", 2)];
    const out = mergeWindows(desc, asc, 2);
    expect(out).toHaveLength(2);
    const exps = out.map((v) => v.expiryDate);
    expect(Math.max(...exps)).toBe(999);
    expect(Math.min(...exps)).toBe(1);
  });
});
