import { describe, expect, it } from "vitest";
import { nameMeta, premiumSitemapEntries, staticSitemapEntries, SITE_URL } from "./seo";
import { DAY, GRACE, PREMIUM, type EnsNameData } from "./ens-name";

const NOW = 1_800_000_000; // fixed unix seconds

function d(over: Partial<EnsNameData>): EnsNameData {
  return {
    label: "vault",
    normalized: "vault",
    letters: 5,
    status: "premium",
    expiry: NOW - GRACE - 5 * DAY, // day 5 of premium
    baseWei: 0n,
    premiumWei: 0n,
    totalWei: 0n,
    ethUsd: 4000,
    buyable: true,
    ...over,
  };
}

describe("nameMeta", () => {
  it("premium: title mentions the auction, description has price and day", () => {
    const m = nameMeta(d({ totalWei: 10n ** 18n }), NOW); // 1 ETH = $4000
    expect(m.title).toBe("vault.eth is in its 21-day premium auction");
    expect(m.description).toContain("$4,000");
    expect(m.description).toContain("day 5 of 21");
    expect(m.index).toBe(true);
  });

  it("premium without a USD price still describes the auction", () => {
    const m = nameMeta(d({ ethUsd: null }), NOW);
    expect(m.description).toContain("day 5 of 21");
    expect(m.description).not.toContain("$");
  });

  it("available: title says available", () => {
    const m = nameMeta(d({ status: "available", expiry: 0 }), NOW);
    expect(m.title).toBe("vault.eth is available to register");
    expect(m.index).toBe(true);
  });

  it("active: registered-until date in description", () => {
    const m = nameMeta(d({ status: "active", buyable: false, expiry: NOW + 400 * DAY }), NOW);
    expect(m.title).toBe("vault.eth is registered");
    expect(m.description).toMatch(/registered until/);
  });

  it("grace: released-after date in description", () => {
    const m = nameMeta(d({ status: "grace", buyable: false, expiry: NOW - 10 * DAY }), NOW);
    expect(m.title).toBe("vault.eth is in its 90-day grace period");
    expect(m.description).toMatch(/premium auction/);
  });

  it("invalid and tooShort are not indexable", () => {
    expect(nameMeta(d({ status: "invalid", normalized: "", buyable: false }), NOW).index).toBe(false);
    expect(nameMeta(d({ status: "tooShort", normalized: "ab", buyable: false }), NOW).index).toBe(false);
  });
});

describe("sitemap entries", () => {
  it("static entries cover the public pages", () => {
    const urls = staticSitemapEntries().map((e) => e.url);
    for (const p of ["/", "/about", "/faq", "/vaults", "/legal/terms", "/legal/privacy", "/legal/risks"]) {
      expect(urls).toContain(`${SITE_URL}${p === "/" ? "" : p}`);
    }
  });

  it("premium entries keep only in-window names and encode labels", () => {
    const rows = [
      { label: "inwindow", expiryDate: NOW - GRACE - 3 * DAY },
      { label: "stillgrace", expiryDate: NOW - GRACE + DAY },
      { label: "done", expiryDate: NOW - GRACE - PREMIUM - DAY },
      { label: "café", expiryDate: NOW - GRACE - 3 * DAY },
    ];
    const urls = premiumSitemapEntries(rows, NOW).map((e) => e.url);
    expect(urls).toEqual([`${SITE_URL}/name/inwindow`, `${SITE_URL}/name/caf%C3%A9`]);
  });
});
