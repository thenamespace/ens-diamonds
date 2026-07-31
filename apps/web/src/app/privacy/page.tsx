import type { Metadata } from "next";

import { LegalPage } from "@/components";
import { privacyContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Notice · ENS Diamonds",
  description: "How the ENS Diamonds interface processes wallet, vault, and technical data.",
};

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
