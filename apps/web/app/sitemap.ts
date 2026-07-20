import type { MetadataRoute } from "next";
import { APP_CHAIN } from "@/lib/app-chain";
import { getAllPremiumLabels } from "@/lib/ens-premium";
import { premiumSitemapEntries, staticSitemapEntries } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (APP_CHAIN.isTestnet) return [];
  const statics = staticSitemapEntries();
  try {
    // Cached full premium-window scan (5 min TTL, shared with Discover).
    const rows = await getAllPremiumLabels();
    return [...statics, ...premiumSitemapEntries(rows, Math.floor(Date.now() / 1000))];
  } catch {
    // A sitemap that 500s is worse than a short one.
    return statics;
  }
}
