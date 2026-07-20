import { SITE_URL } from "./seo";

// Serialize with `<` escaped so untrusted strings (ENS labels) can never close
// the <script> tag this ends up in. Rendered by components/json-ld.tsx.
export function jsonLdString(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ens.diamonds",
    url: SITE_URL,
    logo: `${SITE_URL}/coffer-logo.png`,
    sameAs: ["https://namespace.ninja"],
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ens.diamonds",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/name/{search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

// Product/Offer for a buyable name. Null when there is no USD price (ETH/USD
// oracle down): a schema without a price is noise.
export function nameProductJsonLd(args: { label: string; priceUsd: number | null; premiumEndsAt: number | null }) {
  if (args.priceUsd === null) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${args.label}.eth`,
    description: `The ENS name ${args.label}.eth, purchasable through the ENS registrar.`,
    url: `${SITE_URL}/name/${encodeURIComponent(args.label)}`,
    offers: {
      "@type": "Offer",
      price: args.priceUsd.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/name/${encodeURIComponent(args.label)}`,
      ...(args.premiumEndsAt ? { priceValidUntil: new Date(args.premiumEndsAt * 1000).toISOString() } : {}),
    },
  };
}
