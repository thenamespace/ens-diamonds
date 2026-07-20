import type { MetadataRoute } from "next";
import { APP_CHAIN } from "@/lib/app-chain";
import { SITE_URL } from "@/lib/seo";

// Mainnet: index everything public. Testnet build: index nothing (it is a
// full duplicate of the mainnet site with test data).
export default function robots(): MetadataRoute.Robots {
  if (APP_CHAIN.isTestnet) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      disallow: ["/api/", "/portfolio", "/favourites", "/name/*/buy", "/vaults/new"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
