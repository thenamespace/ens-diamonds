import { describe, expect, it } from "vitest";
import { orgJsonLd, webSiteJsonLd, faqPageJsonLd, breadcrumbJsonLd, nameProductJsonLd } from "./json-ld";

describe("json-ld builders", () => {
  it("Organization and WebSite carry the canonical URL", () => {
    expect(orgJsonLd()).toMatchObject({ "@type": "Organization", url: "https://www.ens.diamonds" });
    const site = webSiteJsonLd();
    expect(site).toMatchObject({ "@type": "WebSite" });
    expect(JSON.stringify(site)).toContain("search_term_string");
  });

  it("FAQPage maps every item", () => {
    const faq = faqPageJsonLd([
      { q: "Q1?", a: "A1." },
      { q: "Q2?", a: "A2." },
    ]);
    expect(faq.mainEntity).toHaveLength(2);
    expect(faq.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q1?",
      acceptedAnswer: { "@type": "Answer", text: "A1." },
    });
  });

  it("BreadcrumbList positions items 1..n", () => {
    const bc = breadcrumbJsonLd([
      { name: "Discover", url: "https://www.ens.diamonds" },
      { name: "vault.eth", url: "https://www.ens.diamonds/name/vault" },
    ]);
    expect(bc.itemListElement.map((i: { position: number }) => i.position)).toEqual([1, 2]);
  });

  it("Product offer uses the live USD price and is null without one", () => {
    const p = nameProductJsonLd({ label: "vault", priceUsd: 1234.56, premiumEndsAt: 1_800_000_000 });
    expect(p).toMatchObject({ "@type": "Product", name: "vault.eth" });
    expect(p?.offers).toMatchObject({ "@type": "Offer", price: "1234.56", priceCurrency: "USD" });
    expect(nameProductJsonLd({ label: "vault", priceUsd: null, premiumEndsAt: null })).toBeNull();
  });
});
