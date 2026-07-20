import type { MetadataRoute } from "next";
import { deriveStatus, weiToUsd, DAY, GRACE, type EnsNameData } from "./ens-name";
import type { WindowRow } from "./ens-premium";

// Canonical origin for the indexable (mainnet) deployment. The Sepolia build
// is never indexed, so a single constant is correct for canonicals/sitemaps.
export const SITE_URL = "https://www.ens.diamonds";

function fmtUsd(n: number): string {
  const compact = n >= 10_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export type NameMeta = { title: string; description: string; index: boolean };

// Per-status <title>/<meta description> for /name/[label]. Pure so it can be
// unit-tested; the route passes live EnsNameData and the current unix time.
export function nameMeta(d: EnsNameData, nowSec: number): NameMeta {
  const name = `${d.normalized || d.label.replace(/\.eth$/i, "")}.eth`;

  if (d.status === "invalid" || d.status === "tooShort") {
    return {
      title: `${name} on ens.diamonds`,
      description: "Look up live ENS premium auction prices and pool ETH with others to register names together.",
      index: false,
    };
  }
  if (d.status === "active") {
    return {
      title: `${name} is registered`,
      description: `${name} is registered until ${fmtDate(d.expiry)}. Add it to your favourites on ens.diamonds and be ready to pool ETH with others if it ever enters the 21-day premium auction.`,
      index: true,
    };
  }
  if (d.status === "grace") {
    return {
      title: `${name} is in its 90-day grace period`,
      description: `${name} expired and can still be renewed by its owner until ${fmtDate(d.expiry + GRACE)}. If it is not renewed, it enters the 21-day premium auction. Track it on ens.diamonds and pool ETH to claim it.`,
      index: true,
    };
  }
  if (d.status === "available") {
    return {
      title: `${name} is available to register`,
      description: `${name} carries no premium and can be registered at the standard ENS price. Register it solo or start a shared vault on ens.diamonds.`,
      index: true,
    };
  }
  // premium
  const day = Math.min(21, Math.max(0, Math.floor((nowSec - (d.expiry + GRACE)) / DAY)));
  const usd = weiToUsd(d.totalWei, d.ethUsd);
  const price = usd === null ? "" : ` for ${fmtUsd(usd)}`;
  return {
    title: `${name} is in its 21-day premium auction`,
    description: `${name} can be registered right now${price}, on day ${day} of 21 of its decaying ENS premium. Pool ETH with others in a shared vault, or buy it solo, on ens.diamonds.`,
    index: true,
  };
}

export function staticSitemapEntries(): MetadataRoute.Sitemap {
  const weekly = (path: string, priority: number) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly" as const,
    priority,
  });
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    weekly("/about", 0.8),
    weekly("/faq", 0.8),
    weekly("/vaults", 0.7),
    weekly("/legal/terms", 0.3),
    weekly("/legal/privacy", 0.3),
    weekly("/legal/risks", 0.3),
  ];
}

// Every name currently inside the 21-day premium window gets its own sitemap
// entry while it is actually buyable. Membership churns daily; the sitemap
// route revalidates hourly.
export function premiumSitemapEntries(rows: WindowRow[], nowSec: number): MetadataRoute.Sitemap {
  return rows
    .filter((r) => deriveStatus(r.expiryDate, nowSec) === "premium")
    .map((r) => ({
      url: `${SITE_URL}/name/${encodeURIComponent(r.label)}`,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    }));
}
