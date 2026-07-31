import type { Metadata } from "next";
import NextLink from "next/link";

import { ExternalLinkIcon, Link, Typography } from "@thenamespace/uikit";

import { AboutFaq, AboutTimeline, VaultReceipt } from "@/components/about";

export const metadata: Metadata = {
  title: "About · ENS Diamonds",
  description:
    "How ENS Diamonds pools ETH for one ENS acquisition and places the name in a shared Safe.",
};

const EXTERNAL_LINK = "https://example.com";

const fixedRules = [
  ["Group", "2–10 distinct owners"],
  ["Approval", "Strict majority of Safe owners"],
  ["Target", "One hidden .eth label"],
  ["Budget", "Never more than maxSpend"],
  ["Attempt", "One commitment window"],
  ["Operator access", "None"],
] as const;

const boundaries = [
  {
    label: "The contract does",
    items: [
      "Keep each contribution separately accounted",
      "Lock funds only during the acquisition window",
      "Register the name directly to the predicted Safe",
      "Make surplus or failed funds claimable",
    ],
  },
  {
    label: "The contract does not",
    items: [
      "Choose the name, members, or Safe threshold",
      "Control the acquired name or member wallets",
      "Charge a protocol fee in the reviewed contract",
      "Pause, upgrade, rescue, or retry a vault",
    ],
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-default">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20 lg:px-8 lg:py-28">
          <div>
            <Typography.Paragraph
              className="font-mono text-xs font-semibold tracking-[0.18em] uppercase"
              color="muted"
            >
              Shared ENS acquisition
            </Typography.Paragraph>
            <Typography.Heading
              className="mt-6 max-w-3xl text-5xl leading-[0.98] tracking-[-0.055em] sm:text-7xl"
              level={1}
            >
              Buy the name as a group.
              <span className="block text-muted">Own it as a group.</span>
            </Typography.Heading>
            <Typography.Paragraph className="mt-8 max-w-xl text-lg leading-8" color="muted">
              ENS Diamonds gives friends one transparent place to pool ETH, execute a time-sensitive
              ENS purchase, and place the name in a Safe they control together.
            </Typography.Paragraph>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <NextLink
                className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                href="/"
              >
                Explore premium names
              </NextLink>
              <NextLink
                className="rounded-full border border-default px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface"
                href="/risks"
              >
                Understand the risks
              </NextLink>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted">
              <span>2–10 owners</span>
              <span>Strict-majority Safe</span>
              <span>One bounded attempt</span>
            </div>
          </div>

          <VaultReceipt />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Typography.Paragraph
              className="font-mono text-xs font-semibold tracking-[0.18em] uppercase"
              color="muted"
            >
              The lifecycle
            </Typography.Paragraph>
            <Typography.Heading className="mt-5 text-4xl tracking-tight sm:text-5xl" level={2}>
              One vault has one job.
            </Typography.Heading>
            <Typography.Paragraph className="mt-5 max-w-md leading-7" color="muted">
              Funding stays reversible until the group enters ENS’s commitment window. From there,
              the attempt has one outcome: acquire the target or return the recorded balances.
            </Typography.Paragraph>
          </div>

          <AboutTimeline />
        </div>
      </section>

      <section className="bg-[#111216] text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <Typography.Paragraph className="font-mono text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">
                Contract boundary
              </Typography.Paragraph>
              <Typography.Heading className="mt-5 text-4xl tracking-tight text-white" level={2}>
                Automation without an operator.
              </Typography.Heading>
              <Typography.Paragraph className="mt-5 max-w-md leading-7 text-white/60">
                The deployed rules coordinate the purchase. They do not give ENS Diamonds a key, an
                administrator role, or a way to take the name.
              </Typography.Paragraph>
            </div>

            <div className="grid gap-px overflow-hidden rounded-3xl bg-white/15 sm:grid-cols-2">
              {boundaries.map((boundary, index) => (
                <div className="bg-[#18191e] p-7 sm:p-8" key={boundary.label}>
                  <Typography.Paragraph
                    className={index === 0 ? "text-[#98e2bc]" : "text-[#f0ad83]"}
                    size="sm"
                  >
                    {boundary.label}
                  </Typography.Paragraph>
                  <ul className="mt-7 space-y-5">
                    {boundary.items.map((item) => (
                      <li className="flex gap-3 text-sm leading-6 text-white/70" key={item}>
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-white/35"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[1fr_0.9fr] lg:gap-24">
          <div>
            <Typography.Paragraph
              className="font-mono text-xs font-semibold tracking-[0.18em] uppercase"
              color="muted"
            >
              Fixed at creation
            </Typography.Paragraph>
            <Typography.Heading className="mt-5 text-4xl tracking-tight sm:text-5xl" level={2}>
              The agreement is visible before anyone deposits.
            </Typography.Heading>
            <Typography.Paragraph className="mt-5 max-w-xl leading-7" color="muted">
              Membership, Safe control, spending authority, and the acquisition target are bound to
              the vault. The interface cannot rewrite them later.
            </Typography.Paragraph>

            <dl className="mt-10 border-t border-default">
              {fixedRules.map(([term, detail]) => (
                <div
                  className="grid grid-cols-[7rem_1fr] gap-5 border-b border-default py-4 sm:grid-cols-[10rem_1fr]"
                  key={term}
                >
                  <dt className="text-sm text-muted">{term}</dt>
                  <dd className="text-sm font-medium">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-[2rem] bg-[#edf0ff] p-7 text-[#171926] sm:p-10 lg:self-start">
            <span className="font-mono text-xs font-semibold tracking-[0.18em] text-[#5b62a8] uppercase">
              After acquisition
            </span>
            <Typography.Heading className="mt-6 text-3xl tracking-tight text-[#171926]" level={3}>
              The Safe—not this website—owns the name.
            </Typography.Heading>
            <Typography.Paragraph className="mt-5 leading-7 text-[#555a78]">
              The Safe receives the ENS name during registration. Its owners approve future record
              changes, renewals, transfers, and Safe configuration according to the threshold.
            </Typography.Paragraph>
            <div className="mt-9 rounded-2xl bg-white/70 p-5">
              <div className="flex items-center gap-3">
                {["A", "B", "C"].map((member) => (
                  <span
                    className="-mr-1 flex size-10 items-center justify-center rounded-full border-2 border-white bg-[#d9ddf7] font-mono text-xs font-semibold"
                    key={member}
                  >
                    {member}
                  </span>
                ))}
                <span className="ml-auto font-mono text-xs text-[#6a6f8d]">2 OF 3</span>
              </div>
              <div className="mt-5 border-t border-dashed border-[#bec3de] pt-5">
                <span className="text-sm text-[#6a6f8d]">Safe asset</span>
                <strong className="mt-1 block text-xl">target.eth</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AboutFaq />

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 rounded-[2rem] border border-default bg-surface px-7 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <Typography.Heading className="text-2xl tracking-tight" level={2}>
              Verify before you participate.
            </Typography.Heading>
            <Typography.Paragraph className="mt-2 leading-7" color="muted">
              Read the protocol risks and inspect the deployed contract before depositing ETH.
            </Typography.Paragraph>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <NextLink
              className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
              href="/risks"
            >
              Read risks
            </NextLink>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-default px-5 py-3 text-sm font-semibold"
              href={EXTERNAL_LINK}
              rel="noreferrer"
              target="_blank"
            >
              View contract
              <ExternalLinkIcon aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
