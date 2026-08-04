import type { MetadataRoute } from "next";

import { appNetwork } from "@/lib/network";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (appNetwork === "testnet") {
    return {
      rules: {
        disallow: "/",
        userAgent: "*",
      },
    };
  }

  return {
    host: SITE_URL,
    rules: {
      disallow: ["/api/", "/vaults"],
      userAgent: "*",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
