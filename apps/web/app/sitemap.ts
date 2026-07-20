import type { MetadataRoute } from "next";
import { APP_CHAIN } from "@/lib/app-chain";
import { staticSitemapEntries } from "@/lib/seo";

// Static pages only. Name pages are deliberately NOT listed: ~24k names churn
// through the premium window and crawlers reach them through the homepage feed
// links anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  if (APP_CHAIN.isTestnet) return [];
  return staticSitemapEntries();
}
