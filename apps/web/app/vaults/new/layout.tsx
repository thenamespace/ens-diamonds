import type { Metadata } from "next";

// Transactional flow: not for the index.
export const metadata: Metadata = {
  title: "Start a vault",
  robots: { index: false, follow: false },
  alternates: { canonical: "/vaults/new" },
};

export default function NewVaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
