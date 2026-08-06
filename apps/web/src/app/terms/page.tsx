import { LegalPage } from "@/components";
import { termsContent } from "@/lib/legal";

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
