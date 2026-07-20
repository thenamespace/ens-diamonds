import type { Metadata } from "next";

export const metadata: Metadata = {
  // A plain-string title here would stop the root layout's title template from
  // reaching /vaults/new and /vaults/[id]; re-declare it for the subtree.
  title: { default: "Browse vaults", template: "%s · ens.diamonds" },
  description:
    "Every open vault on the ens.diamonds escrow. Shared vaults pool ETH to register premium ENS names together, held by a Safe multisig the contributors control.",
  alternates: { canonical: "/vaults" },
};

export default function VaultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
