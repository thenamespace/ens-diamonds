import type { Metadata } from "next";

// Session-private page.
export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
  alternates: { canonical: "/portfolio" },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
