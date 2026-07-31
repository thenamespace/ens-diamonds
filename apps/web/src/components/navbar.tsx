"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { Navbar } from "@thenamespace/uikit";

import { ConnectButton } from "./connect-button";

const navItems = [
  {
    name: "Discover",
    href: "/",
  },
  {
    name: "Vaults",
    href: "/vaults",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
  },
  {
    name: "About",
    href: "/about",
  },
] as const;

export const AppNavbar = () => {
  const pathname = usePathname();

  return (
    <Navbar className="bg-background" maxWidth="full">
      <Navbar.Header className="max-w-7xl">
        <Navbar.Brand className="flex flex-row gap-0 items-center">
          <Image
            src="/icon.png"
            aria-hidden
            className="size-10"
            alt="ENS Diamonds"
            width={40}
            height={40}
          />
          <span className="text-xl font-semibold tracking-tight">ens.diamonds</span>
        </Navbar.Brand>
        <Navbar.Content>
          {navItems.map((item) => (
            <Navbar.Item key={item.name} isCurrent={pathname === item.href} href={item.href}>
              {item.name}
            </Navbar.Item>
          ))}
        </Navbar.Content>
        <Navbar.Spacer />
        <ConnectButton />
      </Navbar.Header>
    </Navbar>
  );
};
