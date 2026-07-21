import type { Metadata } from "next";

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

      </div>
    </div>
  );
}
