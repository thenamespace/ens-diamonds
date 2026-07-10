import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://coffer.xyz"),
  title: "Coffer — Pool up to claim premium ENS names, together",
  description:
    "Premium ENS names cost thousands. Coffer lets a group pool ETH to buy one together — held in an audited escrow with unilateral refunds, then registered by a multisig you all control.",
  keywords: ["ENS", "premium names", "Dutch auction", "multisig", "Safe", "pooling", "ethereum"],
  openGraph: {
    title: "Coffer — Pool up to claim premium ENS names, together",
    description:
      "Found a premium ENS name too rich to grab solo? Start a pool, invite people through their on-chain records, and buy it with a multisig you all control.",
    type: "website",
    url: "https://coffer.xyz",
    siteName: "Coffer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coffer — Pool up to claim premium ENS names, together",
    description: "Pool ETH to buy a premium ENS name. Audited escrow, unilateral refunds, a multisig you all control.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
