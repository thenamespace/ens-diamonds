import "@rainbow-me/rainbowkit/styles.css";
import "../styles.css";
import type { Metadata, Viewport } from "next";

import { Providers } from "@/app/providers";
import { auth } from "@/auth";
import { AppFooter, AppNavbar, JsonLd } from "@/components";
import { organizationJsonLd, SITE_URL, siteConfig, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  authors: [{ name: "Namespace", url: "https://namespace.ninja/" }],
  category: "technology",
  creator: "Namespace",
  description: siteConfig.description,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  icons: {
    apple: [{ sizes: "180x180", type: "image/png", url: "/apple-icon.png" }],
    icon: [{ sizes: "500x500", type: "image/png", url: "/icon.png" }],
    shortcut: ["/icon.png"],
  },
  keywords: ["ENS", "premium names", "Dutch auction", "multisig", "Safe", "pooling", "Ethereum"],
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: siteConfig.ogDescription,
    images: [
      {
        alt: siteConfig.name,
        height: 1260,
        url: "/diamonds-preview.png",
        width: 2400,
      },
    ],
    locale: "en_US",
    siteName: siteConfig.name,
    title: siteConfig.title,
    type: "website",
    url: SITE_URL,
  },
  publisher: "Namespace",
  referrer: "origin-when-cross-origin",
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    description: siteConfig.twitterDescription,
    images: ["/diamonds-preview.png"],
    title: siteConfig.title,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f7f7",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <link crossOrigin="anonymous" href="https://app.namespace.ninja" rel="preconnect" />
      </head>
      <body className="flex min-h-screen flex-col border-default bg-background text-foreground">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <Providers session={session}>
          <a
            className="fixed top-3 left-3 z-50 -translate-y-20 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform focus-visible:translate-y-0"
            href="#main-content"
          >
            Skip to Content
          </a>
          <AppNavbar />
          <div className="flex-1" id="main-content" tabIndex={-1}>
            {children}
          </div>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
