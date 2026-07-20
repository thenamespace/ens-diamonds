import type { Metadata } from "next";
import { FAQ_ITEMS } from "@/lib/faq-content";
import { faqPageJsonLd } from "@/lib/json-ld";
import JsonLd from "@/components/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "How ens.diamonds works: the ENS 21-day temporary premium, pooling ETH in a shared vault, unilateral refunds, Safe multisig custody, audits, and costs.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="wrap">
      <JsonLd data={faqPageJsonLd(FAQ_ITEMS)} />
      <div className="mx-auto max-w-[760px]">
        <div className="page-head">
          <div>
            <h1>Frequently asked questions</h1>
            <p>Everything about pooling ETH to buy premium ENS names together.</p>
          </div>
        </div>
        <div className="space-y-9">
          {FAQ_ITEMS.map((item) => (
            <section key={item.q}>
              <h2 className="mb-2.5 text-[21px] tracking-[-0.015em]">{item.q}</h2>
              <p className="m-0 max-w-[680px] text-[15px] leading-[1.65] text-muted">{item.a}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
