import { LegalPage } from "@/components";
import { privacyContent } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalPage
      content={privacyContent}
      lastUpdated="31 July 2026"
      slug="privacy"
      title="Privacy Notice"
    />
  );
}
