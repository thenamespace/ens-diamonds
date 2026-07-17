"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@thenamespace/uikit";
import { BadgeCheckIcon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import ConnectButton from "./connect-button";
import { APP_CHAIN } from "@/lib/app-chain";
import { ESCROW_ADDRESS, isEscrowConfigured } from "@/lib/chain";

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/pools", label: "Vaults" },
  { href: "/favourites", label: "Favourites" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[130px] flex-col gap-2.5">
      <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">{title}</span>
      {children}
    </div>
  );
}

const footerLink = "text-[13.5px] text-muted transition-colors hover:text-foreground";

// The site's final tear-off stub: dashed perforation on top, recessed ticket
// surface, nav + protocol trust links, ghost wordmark at the very bottom.
function SiteFooter() {
  return (
    <footer className="site-footer mt-16">
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-12 pb-6">
        <div className="flex flex-wrap justify-between gap-x-10 gap-y-10">
          {/* Brand block */}
          <div className="flex max-w-[300px] flex-col items-start gap-3.5">
            <Link className="flex items-center gap-2.5 font-semibold" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="block size-9 object-contain" height={36} src="/coffer-logo.png" width={36} />
              <span className="text-[17px]">ens.diamonds</span>
            </Link>
            <p className="m-0 text-[13.5px] leading-relaxed text-muted">
              Pool ETH with friends to claim premium ENS names together. Escrowed onchain, owned by a multisig you all
              control.
            </p>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-separator bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-foreground"
              href="https://ens.domains"
              rel="noreferrer"
              target="_blank"
            >
              <HugeiconsIcon className="text-[#2f6bff]" icon={BadgeCheckIcon} size={15} strokeWidth={2} aria-hidden />
              ENS Service Provider
            </a>
          </div>

          <div className="flex flex-wrap gap-x-14 gap-y-10">
            <FooterColumn title="Explore">
              <Link className={footerLink} href="/">
                Discover
              </Link>
              <Link className={footerLink} href="/pools">
                Vaults
              </Link>
              <Link className={footerLink} href="/favourites">
                Favourites
              </Link>
              <Link className={footerLink} href="/portfolio">
                Portfolio
              </Link>
            </FooterColumn>

            <FooterColumn title="Protocol">
              {isEscrowConfigured && (
                <a
                  className={`${footerLink} font-mono text-[12.5px]`}
                  href={`${APP_CHAIN.explorerUrl}/address/${ESCROW_ADDRESS}`}
                  rel="noreferrer"
                  target="_blank"
                  title="Verify the escrow contract yourself"
                >
                  Escrow contract ↗
                </a>
              )}
              <a className={footerLink} href={APP_CHAIN.ensAppUrl} rel="noreferrer" target="_blank">
                ENS app ↗
              </a>
              <a className={footerLink} href="https://app.safe.global" rel="noreferrer" target="_blank">
                Safe ↗
              </a>
              <a className={footerLink} href="https://resolvio.xyz" rel="noreferrer" target="_blank">
                Resolvio ↗
              </a>
            </FooterColumn>

            <FooterColumn title="More">
              <Link className={footerLink} href="/about">
                About
              </Link>
              <Link className={footerLink} href="/pools/new">
                Start a vault
              </Link>
              <a className={footerLink} href="https://namespace.ninja" rel="noreferrer" target="_blank">
                Namespace ↗
              </a>
            </FooterColumn>
          </div>
        </div>

        <div className="border-separator mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <span className="text-[12.5px] text-muted">© {new Date().getFullYear()} ens.diamonds</span>
          <span className="font-mono text-[11.5px] tracking-[0.05em] text-muted">non-custodial · open-source</span>
          <span className="text-[12.5px] text-muted">
            Built by{" "}
            <a className="hover:text-foreground underline underline-offset-2" href="https://namespace.ninja" rel="noreferrer" target="_blank">
              Namespace
            </a>{" "}
            Ninjas <span aria-hidden>🥷</span>
          </span>
        </div>
      </div>

      {/* Ghost wordmark — cropped oversized brand at the page's very end. */}
      <div aria-hidden className="pointer-events-none mx-auto h-[0.78em] w-full max-w-[1180px] overflow-hidden px-6 text-center text-[clamp(64px,10vw,132px)] leading-none font-semibold tracking-tight select-none">
        <span className="text-foreground/[0.05]">ens.diamonds</span>
      </div>
    </footer>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar className="border-separator border-b">
        {/* max-w matches .wrap (1180px + 24px padding) so the brand and the
            connect button line up with the page content below. */}
        <Navbar.Header className="max-w-[1180px]">
          <Navbar.MenuToggle className="md:hidden" />
          <Navbar.Brand>
            <Link className="flex items-center gap-2.5 font-semibold" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="block size-11 object-contain" height={44} src="/coffer-logo.png" width={44} />
              {/* Wordmark hides on very narrow screens; the logo carries the brand. */}
              <span className="hidden min-[400px]:inline">ens.diamonds</span>
            </Link>
          </Navbar.Brand>
          <Navbar.Content className="hidden md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Navbar.Item href={href} isCurrent={isCurrent(pathname, href)} key={href}>
                {label}
              </Navbar.Item>
            ))}
          </Navbar.Content>
          <Navbar.Spacer />
          <Navbar.Content>
            <ConnectButton />
          </Navbar.Content>
          <Navbar.Menu>
            {NAV_LINKS.map(({ href, label }) => (
              <Navbar.MenuItem href={href} isCurrent={isCurrent(pathname, href)} key={href}>
                {label}
              </Navbar.MenuItem>
            ))}
          </Navbar.Menu>
        </Navbar.Header>
      </Navbar>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
