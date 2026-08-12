import type { MetadataRoute } from "next";

export const SITE_URL = "https://www.ens.diamonds";

export const siteConfig = {
  description:
    "Premium ENS names cost thousands. ens.diamonds lets a group pool ETH to buy one together. Funds sit in an open-source escrow with unilateral refunds, and a multisig you all control registers the name.",
  name: "ens.diamonds",
  ogDescription:
    "Found a premium ENS name too rich to grab solo? Start a vault, invite people through their onchain records, and buy it with a multisig you all control.",
  title: "ens.diamonds: Pool up to claim premium ENS names, together",
  twitterDescription:
    "Pool ETH to buy a premium ENS name. Open-source escrow, unilateral refunds, a multisig you all control.",
} as const;

export const organizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  logo: `${SITE_URL}/coffer-logo.png`,
  name: siteConfig.name,
  sameAs: ["https://namespace.ninja/", "https://github.com/thenamespace/ens-diamonds"],
  url: SITE_URL,
});

export const websiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  description: siteConfig.description,
  name: siteConfig.name,
  potentialAction: {
    "@type": "SearchAction",
    "query-input": "required name=search_term_string",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/name/{search_term_string}.eth`,
    },
  },
  url: SITE_URL,
});

export const serializeJsonLd = (data: object) => JSON.stringify(data).replaceAll("<", "\\u003c");

export const getStaticSitemapEntries = (): MetadataRoute.Sitemap => {
  const weekly = (path: string, priority: number) => ({
    changeFrequency: "weekly" as const,
    priority,
    url: `${SITE_URL}${path}`,
  });

  return [
    { changeFrequency: "daily", priority: 1, url: SITE_URL },
    weekly("/vaults", 0.8),
    weekly("/about", 0.8),
    weekly("/terms", 0.3),
    weekly("/privacy", 0.3),
    weekly("/risks", 0.3),
  ];
};
