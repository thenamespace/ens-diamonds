import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/app-shell";
import Providers from "./providers";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ens.diamonds"),
  title: "ens.diamonds — Pool up to claim premium ENS names, together",
  description:
    "Premium ENS names cost thousands. ens.diamonds lets a group pool ETH to buy one together — held in an open-source escrow with unilateral refunds, then registered by a multisig you all control.",
  keywords: ["ENS", "premium names", "Dutch auction", "multisig", "Safe", "pooling", "ethereum"],
  openGraph: {
    title: "ens.diamonds — Pool up to claim premium ENS names, together",
    description:
      "Found a premium ENS name too rich to grab solo? Start a vault, invite people through their onchain records, and buy it with a multisig you all control.",
    type: "website",
    url: "https://www.ens.diamonds",
    siteName: "ens.diamonds",
    images: [{ url: "/diamonds-preview.png", width: 2400, height: 1260, alt: "ens.diamonds" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ens.diamonds — Pool up to claim premium ENS names, together",
    description: "Pool ETH to buy a premium ENS name. Open-source escrow, unilateral refunds, a multisig you all control.",
    images: ["/diamonds-preview.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${mono.variable}`} data-theme="light">
      <body className="bg-background text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
