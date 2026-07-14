import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · ens.diamonds",
  description:
    "ens.diamonds lets a group pool ETH into a shared vault to claim premium ENS names no one wants to buy alone. Built by the Namespace team.",
};

export default function AboutPage() {
  return (
    <div className="wrap about">
      <section className="about-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="about-logo" src="/coffer-logo.png" alt="ens.diamonds" width={148} height={148} />
        <h1>ens.diamonds</h1>
        <p className="about-tagline">
          <span className="about-hook">The best ENS names are too expensive to buy alone.</span>
          ens.diamonds lets groups <strong>pool ETH</strong> into a shared vault, <strong>buy premium names</strong> together,
          and <strong>co-own them</strong>.
        </p>
      </section>

      <section className="about-section">
        <h2>What ens.diamonds does</h2>
        <p className="about-lead">
          ens.diamonds turns buying ENS names in temporary premium from a solo experience into a multiplayer one.
        </p>
        <p className="about-lead">
          When a name expires it enters a 21-day auction where the price starts high and decays to zero, but the best
          names are usually too expensive for any one person to grab alone.
        </p>
        <p className="about-lead">
          Instead of watching them be sniped by wealthy individuals, create a shared vault for you and your friends,
          split the cost, and co-own the name together.
        </p>
        <p className="about-lead">
          Funds sit in an escrow contract until you decide to move them to Safe multisig to do the purchase. You can
          always pull out of escrow if you want to, but once the name is bought, it is held by a Safe multisig you all
          control.
        </p>
        <p className="about-lead">
          No one can run off with the money, with a purchased name, and no single person can act alone.
        </p>
      </section>

      <section className="about-section built-by">
        <p className="about-lead">
          ens.diamonds is made by the{" "}
          <a href="https://namespace.ninja" target="_blank" rel="noreferrer">
            Namespace
          </a>{" "}
          team — an ENS-DAO-backed service provider.
        </p>
      </section>
    </div>
  );
}
