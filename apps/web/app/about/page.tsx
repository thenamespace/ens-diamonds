import type { Metadata } from "next";
import { buttonVariants } from "@thenamespace/uikit/button";
import { FAQ_ITEMS } from "@/lib/faq-content";
import { faqPageJsonLd } from "@/lib/json-ld";
import JsonLd from "@/components/json-ld";

export const metadata: Metadata = {
  title: "About",
  description:
    "ens.diamonds lets a group pool ETH into a shared vault to claim premium ENS names no one wants to buy alone. Built by the Namespace team.",
  alternates: { canonical: "/about" },
};

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto max-w-[680px] text-base leading-[1.65] text-muted [&_a]:font-semibold [&_a]:text-accent [&_strong]:text-foreground">
      {children}
    </p>
  );
}

export default function AboutPage() {
  return (
    <div className="wrap">
      <div className="mx-auto max-w-[860px]">
        <section className="border-b border-separator pt-6 pb-11 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mx-auto h-[120px] w-[120px] object-contain drop-shadow-[0_12px_28px_rgba(18,21,28,0.14)] min-[721px]:h-[148px] min-[721px]:w-[148px]"
            src="/coffer-logo.png"
            alt="ens.diamonds"
            width={148}
            height={148}
          />
          <h1 className="mt-3.5 mb-0 text-[40px] tracking-[-0.03em] min-[721px]:text-[52px]">ens.diamonds</h1>
          <p className="mx-auto mt-4 mb-0 max-w-[560px] text-lg leading-[1.55] text-muted">
            <span className="mb-2.5 block text-[23px] font-semibold tracking-[-0.02em] text-foreground">
              The best ENS names are too expensive to buy alone.
            </span>
            ens.diamonds lets groups <strong className="font-semibold text-accent">pool ETH</strong> into a shared
            vault, <strong className="font-semibold text-accent">buy premium names</strong> together, and{" "}
            <strong className="font-semibold text-accent">co-own them</strong>.
          </p>
        </section>

        <section className="mt-12 space-y-3.5 text-center">
          <h2 className="mb-4 text-[26px] tracking-[-0.02em]">What ens.diamonds does</h2>
          <Lead>
            ens.diamonds turns buying ENS names in temporary premium from a solo experience into a multiplayer one.
          </Lead>
          <Lead>
            When a name expires it enters a 21-day auction where the price starts high and decays to zero, but the best
            names are usually too expensive for any one person to grab alone.
          </Lead>
          <Lead>
            Instead of watching them be sniped by wealthy individuals, create a shared vault for you and your friends,
            split the cost, and co-own the name together.
          </Lead>
          <Lead>
            Funds sit in an escrow contract until you decide to move them to Safe multisig to do the purchase. You can
            always pull out of escrow if you want to, but once the name is bought, it is held by a Safe multisig you
            all control.
          </Lead>
          <Lead>No one can run off with the money, with a purchased name, and no single person can act alone.</Lead>
        </section>

        <section className="mt-12">
          <JsonLd data={faqPageJsonLd(FAQ_ITEMS)} />
          <h2 className="mb-6 text-center text-[26px] tracking-[-0.02em]">Frequently asked questions</h2>
          <div className="mx-auto max-w-[680px]">
            {FAQ_ITEMS.map((item) => (
              <details className="group border-b border-separator" key={item.q}>
                <summary className="-mx-3 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-4 text-[15px] font-semibold transition-colors duration-150 select-none hover:bg-foreground/[0.04] group-open:hover:bg-transparent [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg
                    aria-hidden
                    className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                    fill="none"
                    height="15"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                    width="15"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="m-0 pb-4 text-[15px] leading-[1.65] text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 pb-4 text-center">
          <h2 className="mb-2 text-[26px] tracking-[-0.02em]">Feedback or questions?</h2>
          <p className="mx-auto mt-0 mb-5 max-w-[480px] text-muted">
            Come say hi in our Telegram group. We&rsquo;d love to hear from you.
          </p>
          {/* TODO: swap for the dedicated feedback TG group when it exists */}
          <a
            className={`${buttonVariants({ variant: "primary" })} !h-12 !px-8 !text-base`}
            href="https://t.me/+2xzOUH_laAZhYTA6"
            rel="noreferrer"
            target="_blank"
          >
            Join the Telegram ↗
          </a>
        </section>

      </div>
    </div>
  );
}
