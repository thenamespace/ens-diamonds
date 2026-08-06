import type { MetadataRoute } from "next";

import { appNetwork } from "@/lib/network";
import { getStaticSitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return appNetwork === "testnet" ? [] : getStaticSitemapEntries();
}
