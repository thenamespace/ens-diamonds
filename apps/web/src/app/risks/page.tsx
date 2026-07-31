import type { Metadata } from "next";

import { LegalPage } from "@/components";
import { risksContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Protocol Risks · ENS Diamonds",
  description: "Technical, operational, and economic risks of using ENS Diamonds.",
};

export default function RisksPage() {
  return (
    <LegalPage
      content={risksContent}
      lastUpdated="31 July 2026"
      slug="risks"
      title="Protocol Risks"
    />
  );
}
