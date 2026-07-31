"use client";

import type { ComponentProps } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Navbar } from "@thenamespace/uikit";

import { ConnectButton } from "./connect-button";

type NavbarItemRenderProps = Parameters<
  NonNullable<ComponentProps<typeof Navbar.Item>["render"]>
>[0];

const createNavbarLink = (href: string, label: string) => (props: NavbarItemRenderProps) => (
  <Link href={href} {...props}>
    {label}
  </Link>
);

const navItems = [
  {
    name: "Discover",
    href: "/",
    render: createNavbarLink("/", "Discover"),
  },
  {
    name: "Vaults",
    href: "/vaults",
    render: createNavbarLink("/vaults", "Vaults"),
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    render: createNavbarLink("/portfolio", "Portfolio"),
  },
  {
    name: "About",
    href: "/about",
    render: createNavbarLink("/about", "About"),
  },
] as const;

export const AppNavbar = () => {
  const pathname = usePathname();

  return (
    <Navbar className="bg-background" maxWidth="full">
      <Navbar.Header className="max-w-7xl">
        <Link href="/" aria-label="ENS Diamonds home">
          <Navbar.Brand className="flex flex-row items-center gap-0">
            <Image
              src="/icon.png"
              aria-hidden
              className="size-10"
              alt="ENS Diamonds"
              width={40}
              height={40}
            />
            <span className="hidden text-xl font-semibold tracking-tight sm:inline">
              ens.diamonds
            </span>
          </Navbar.Brand>
        </Link>
        <Navbar.Content className="hidden md:flex">
          {navItems.map((item) => (
            <Navbar.Item key={item.name} isCurrent={pathname === item.href} render={item.render}>
              {item.name}
            </Navbar.Item>
          ))}
        </Navbar.Content>
        <Navbar.Spacer />
        <ConnectButton />
        <Navbar.MenuToggle className="md:hidden" />
      </Navbar.Header>
      <Navbar.Menu>
        {navItems.map((item) => (
          <Navbar.MenuItem key={item.name} isCurrent={pathname === item.href} render={item.render}>
            {item.name}
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
};
