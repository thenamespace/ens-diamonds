import "@rainbow-me/rainbowkit/styles.css";
import "../styles.css";
import type { Metadata } from "next";

import { Providers } from "@/app/providers";
import { auth } from "@/auth";
import { AppFooter, AppNavbar } from "@/components";

export const metadata: Metadata = {
  title: "ENS Diamonds",
  description: "Acquire ENS names together.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-background text-foreground border-default">
        <Providers session={session}>
          <AppNavbar />
          <div className="flex-1">{children}</div>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
