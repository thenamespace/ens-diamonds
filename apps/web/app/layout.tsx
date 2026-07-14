import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/app-shell";
import Providers from "./providers";

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
  metadataBase: new URL("https://ens.diamonds"),
  title: "ens.diamonds — Pool up to claim premium ENS names, together",
  description:
    "Premium ENS names cost thousands. ens.diamonds lets a group pool ETH to buy one together — held in an open-source escrow with unilateral refunds, then registered by a multisig you all control.",
  keywords: ["ENS", "premium names", "Dutch auction", "multisig", "Safe", "pooling", "ethereum"],
  openGraph: {
    title: "ens.diamonds — Pool up to claim premium ENS names, together",
    description:
      "Found a premium ENS name too rich to grab solo? Start a vault, invite people through their on-chain records, and buy it with a multisig you all control.",
    type: "website",
    url: "https://ens.diamonds",
    siteName: "ens.diamonds",
    images: [{ url: "/coffer-logo.png", width: 500, height: 500, alt: "ens.diamonds" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ens.diamonds — Pool up to claim premium ENS names, together",
    description: "Pool ETH to buy a premium ENS name. Open-source escrow, unilateral refunds, a multisig you all control.",
    images: ["/coffer-logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
