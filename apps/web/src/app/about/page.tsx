import Image from "next/image";
import NextLink from "next/link";

import { buttonVariants, ExternalLinkIcon, Link, Typography } from "@thenamespace/uikit";

import { AboutFaq, AboutTimeline } from "@/components/about";

const EXTERNAL_LINK = "https://example.com";

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-default">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <Image
              alt="ENS Diamonds"
              className="mx-auto size-20 sm:size-24"
              height={96}
              priority
              src="/icon.png"
              width={96}
            />
            <Typography.Paragraph
              className="mt-7 text-center font-mono text-xs font-semibold tracking-[0.18em] uppercase"
              color="muted"
            >
              ENS Diamonds
            </Typography.Paragraph>
            <Typography.Heading
              className="mx-auto mt-5 max-w-4xl text-center text-balance text-4xl leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
              level={1}
            >
              Pool ETH for one name.
              <span className="block text-muted">Own it in a Safe together.</span>
            </Typography.Heading>
            <Typography.Paragraph
              className="mx-auto mt-7 max-w-2xl text-center text-base leading-7 sm:text-lg sm:leading-8"
              color="muted"
            >
              ENS Diamonds coordinates one shared .eth acquisition without taking custody of the
              purchased name. Members fund an onchain vault; ENS registers directly to the Safe they
              configured.
            </Typography.Paragraph>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <NextLink className={buttonVariants({ size: "md", variant: "primary" })} href="/">
                Explore Premium Names
              </NextLink>
              <NextLink
                className={buttonVariants({ size: "md", variant: "secondary" })}
                href="/risks"
              >
                Understand the Risks
              </NextLink>
            </div>
          </div>
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
            <Typography.Heading
              className="mt-5 text-balance text-4xl tracking-tight sm:text-5xl"
              level={2}
            >
              One vault has one job.
            </Typography.Heading>
            <Typography.Paragraph className="mt-5 max-w-md leading-7" color="muted">
              Funding stays reversible until the group enters ENS&apos;s commitment window. The
              attempt then either acquires the target for the Safe or returns the recorded balances.
            </Typography.Paragraph>
          </div>

          <AboutTimeline />
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
            <NextLink className={buttonVariants({ size: "md" })} href="/risks">
              Read Risks
            </NextLink>
            <Link
              className={buttonVariants({ size: "md", variant: "secondary" })}
              href={EXTERNAL_LINK}
              rel="noreferrer"
              target="_blank"
            >
              View Contract
              <ExternalLinkIcon aria-hidden className="size-3 opacity-60" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
