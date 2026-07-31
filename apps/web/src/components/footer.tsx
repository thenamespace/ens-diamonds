import Image from "next/image";
import NextLink from "next/link";

import { ExternalLinkIcon, Link, SuccessIcon, Typography } from "@thenamespace/uikit";

const EXTERNAL_LINK = "https://example.com";

type FooterLink = {
  external?: boolean;
  href: string;
  label: string;
};

const linkGroups: { label: string; links: FooterLink[] }[] = [
  {
    label: "Explore",
    links: [
      { href: "/", label: "Discover" },
      { href: "/vaults", label: "Vaults" },
      { href: "/favourites", label: "Favourites" },
      { href: "/portfolio", label: "Portfolio" },
    ],
  },
  {
    label: "Protocol",
    links: [
      { external: true, href: EXTERNAL_LINK, label: "Escrow contract" },
      { external: true, href: EXTERNAL_LINK, label: "ENS app" },
      { external: true, href: EXTERNAL_LINK, label: "Safe" },
      { external: true, href: EXTERNAL_LINK, label: "Resolvio" },
    ],
  },
  {
    label: "More",
    links: [
      { href: "/about", label: "About" },
      { external: true, href: EXTERNAL_LINK, label: "Feedback" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/risks", label: "Risks" },
    ],
  },
];

export const AppFooter = () => (
  <footer className="relative mt-16 overflow-hidden border-t border-dashed border-default bg-background">
    <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-14 pb-28 sm:px-6 sm:pt-16 lg:px-8">
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(18rem,1.15fr)_minmax(30rem,1fr)] lg:items-start">
        <div className="max-w-md">
          <NextLink
            aria-label="ENS Diamonds home"
            className="inline-flex items-center gap-2.5"
            href="/"
          >
            <Image alt="" aria-hidden height={40} src="/icon.png" width={40} />
            <Typography.Heading className="text-xl tracking-tight" level={3}>
              ens.diamonds
            </Typography.Heading>
          </NextLink>

          <Typography.Paragraph className="mt-5 max-w-sm leading-7" color="muted">
            Pool ETH with friends to acquire premium ENS names together. Escrowed onchain and owned
            by a multisig you all control.
          </Typography.Paragraph>

          <Link
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-default px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            href={EXTERNAL_LINK}
            rel="noreferrer"
            target="_blank"
          >
            <SuccessIcon aria-hidden className="size-4 text-success" />
            Audit reports
            <ExternalLinkIcon aria-hidden className="size-2.5 opacity-60" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:gap-x-10">
          {linkGroups.map((group) => (
            <FooterLinkGroup group={group} key={group.label} />
          ))}
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-5 border-t border-default pt-7 sm:flex-row sm:items-center sm:justify-between">
        <Typography.Paragraph color="muted" size="sm">
          © 2026 ens.diamonds ·{" "}
          <Link className="font-medium" href={EXTERNAL_LINK} rel="noreferrer" target="_blank">
            open-source
          </Link>
        </Typography.Paragraph>

        <Link
          aria-label="Built by Namespace Ninjas"
          className="inline-flex w-fit items-center gap-3"
          href={EXTERNAL_LINK}
          rel="noreferrer"
          target="_blank"
        >
          <span className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
            Built by Namespace Ninjas
          </span>
          <Image
            alt="Namespace"
            className="h-auto w-32"
            height={106}
            src="/namespace-logo-dark.svg"
            width={690}
          />
        </Link>
      </div>
    </div>

    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-[0.3em] text-center text-[clamp(5rem,15vw,13rem)] leading-none font-semibold tracking-[-0.075em] text-foreground/[0.035]"
    >
      ens.diamonds
    </span>
  </footer>
);

const FooterLinkGroup = ({ group }: { group: (typeof linkGroups)[number] }) => (
  <nav aria-label={`${group.label} links`}>
    <Typography.Paragraph
      className="text-xs font-semibold tracking-[0.18em] uppercase"
      color="muted"
    >
      {group.label}
    </Typography.Paragraph>
    <ul className="mt-4 space-y-2.5">
      {group.links.map((link) => (
        <li key={link.label}>
          {link.external ? (
            <Link
              className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
              href={link.href}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
              <ExternalLinkIcon aria-hidden className="size-2.5 opacity-60" />
            </Link>
          ) : (
            <NextLink
              className="text-sm text-muted transition-colors hover:text-foreground"
              href={link.href}
            >
              {link.label}
            </NextLink>
          )}
        </li>
      ))}
    </ul>
  </nav>
);
