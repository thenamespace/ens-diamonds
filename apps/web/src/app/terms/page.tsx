import type { Metadata } from "next";

import { LegalPage } from "@/components";
import { termsContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service · ENS Diamonds",
  description: "Terms governing use of the ENS Diamonds interface.",
};

export default function TermsPage() {
  return (
    <LegalPage
      content={termsContent}
      lastUpdated="31 July 2026"
      slug="terms"
      title="Terms of Service"
    />
  );
}
