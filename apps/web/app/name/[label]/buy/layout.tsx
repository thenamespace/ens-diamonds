import type { Metadata } from "next";

// Transactional page: keep it out of the index, canonicalized to the name page.
export async function generateMetadata({ params }: { params: Promise<{ label: string }> }): Promise<Metadata> {
  const { label } = await params;
  return {
    title: `Buy ${decodeURIComponent(label)}.eth`,
    robots: { index: false, follow: false },
    alternates: { canonical: `/name/${label}` },
  };
}

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
