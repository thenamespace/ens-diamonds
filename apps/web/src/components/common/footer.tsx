import Image from "next/image";
import NextLink from "next/link";

import {
  buttonVariants,
  ExternalLinkIcon,
  Link,
  SuccessIcon,
  Typography,
} from "@thenamespace/uikit";

import { activeChain, Contracts } from "@/lib/network";

const REPOSITORY_URL = "https://github.com/thenamespace/ens-diamonds";
const AUDIT_REPORTS_URL = `${REPOSITORY_URL}/tree/main/audits`;
const CONTRACT_URL = `${activeChain.blockExplorers.default.url}/address/${Contracts.ensDiamonds.address}`;

type FooterLink = {
  external?: boolean;
  href: string;
  label: string;
};

const linkGroups = [
  {
    label: "Explore",
    links: [
      { href: "/", label: "Discover" },
      { href: "/vaults", label: "Vaults" },
    ],
  },
  {
    label: "Protocol",
    links: [
      { external: true, href: CONTRACT_URL, label: "ENS Diamonds contract" },
      { external: true, href: "https://app.ens.domains/", label: "ENS app" },
      { external: true, href: "https://app.safe.global/", label: "Safe" },
      { external: true, href: "https://resolvio.xyz/", label: "Resolvio" },
    ],
  },
  {
    label: "More",
    links: [
      { href: "/about", label: "About" },
      { external: true, href: "https://t.me/+2xzOUH_laAZhYTA6", label: "Feedback" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/risks", label: "Risks" },
    ],
  },
] satisfies { label: string; links: FooterLink[] }[];

export const AppFooter = () => (
  <footer className="relative mt-16 overflow-hidden border-t border-dashed border-default bg-background">
    <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-14 pb-32 sm:px-6 sm:pt-16 sm:pb-36 lg:px-8">
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
            className={`${buttonVariants({ size: "sm", variant: "secondary" })} mt-6 w-fit`}
            href={AUDIT_REPORTS_URL}
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
          <Link className="font-medium" href={REPOSITORY_URL} rel="noreferrer" target="_blank">
            open-source
          </Link>
        </Typography.Paragraph>

        <Link
          aria-label="Built by Namespace Ninjas"
          className="inline-flex w-fit items-center gap-3"
          href="https://namespace.ninja/"
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
      className="pointer-events-none absolute inset-x-0 -bottom-[0.3em] pt-8 text-center text-[clamp(5rem,15vw,13rem)] leading-none font-semibold tracking-[-0.035em] text-foreground/[0.035]"
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
