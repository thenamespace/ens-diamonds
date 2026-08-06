import { LegalPage } from "@/components";
import { risksContent } from "@/lib/legal";

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
