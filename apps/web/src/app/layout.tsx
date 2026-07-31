import "@rainbow-me/rainbowkit/styles.css";
import "../styles.css";
import type { Metadata } from "next";

import { Providers } from "@/app/providers";
import { auth } from "@/auth";
import { AppNavbar } from "@/components";

export const metadata: Metadata = {
  title: "ENS Diamonds",
  description: "Acquire ENS names together.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          <AppNavbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
