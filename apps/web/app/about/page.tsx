import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Coffer",
  description:
    "Coffer lets a group pool ETH into a shared vault to claim premium ENS names no one wants to buy alone. Built by the Namespace team.",
};

export default function AboutPage() {
  return (
    <div className="wrap about">
      <section className="about-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="about-logo" src="/coffer-logo.png" alt="Coffer" width={148} height={148} />
        <h1>Coffer</h1>
        <p className="about-tagline">
          <span className="about-hook">The best ENS names are too expensive to buy alone.</span>
          Coffer lets groups <strong>pool ETH</strong> into a shared vault, <strong>buy premium names</strong> together,
          and <strong>co-own them</strong>.
        </p>
      </section>

      <section className="about-section">
        <h2>What Coffer does</h2>
        <p className="about-lead">
          Coffer turns buying premium ENS names from a solo experience into a multiplayer one. When a name expires it
          enters a 21-day auction where the price starts high and decays to zero — but the best names are still too
          expensive for any one person to grab alone. Instead of watching them slip by, rally a few people, split the
          cost, and co-own the name together: funds sit in an audited escrow you can always pull out of, and the name is
          bought and held by a multisig you all control. No one can run off with the money, and no single person can act
          alone.
        </p>
      </section>

      <section className="about-section built-by">
        <p className="about-lead">
          Coffer is made by the{" "}
          <a href="https://namespace.ninja" target="_blank" rel="noreferrer">
            Namespace
          </a>{" "}
          team — an ENS-DAO-backed service provider.
        </p>
      </section>
    </div>
  );
}
