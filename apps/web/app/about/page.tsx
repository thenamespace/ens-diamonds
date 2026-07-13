import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Coffer",
  description:
    "Coffer lets a group pool ETH into a shared vault to claim premium ENS names no one wants to buy alone. Built by the Namespace team.",
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="howto-step">
      <span className="howto-num">{n}</span>
      <span>{children}</span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="wrap about">
      <section className="about-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="about-logo" src="/coffer-logo.png" alt="Coffer" width={148} height={148} />
        <h1>Coffer</h1>
        <p className="about-tagline">
          Some ENS names are too rich to grab alone. Coffer lets a group pool ETH into a shared vault, buy the name
          together, and co-own it — no trust required, all on-chain.
        </p>
        <div className="about-cta">
          <Link className="btn btn-primary btn-lg" href="/">
            Browse names in premium
          </Link>
          <Link className="btn btn-soft btn-lg" href="/pools/new">
            Start a vault
          </Link>
        </div>
      </section>

      <section className="about-section">
        <h2>What Coffer does</h2>
        <p className="about-lead">
          When a premium ENS name expires, it enters a 21-day auction where the price starts high and decays to zero.
          The best names are still expensive for any one person — so most people watch them slip by. Coffer turns that
          solo problem into a group one: rally a few people, split the cost, and own the name together.
        </p>
        <div className="about-grid">
          <div className="feature">
            <span className="feature-k">Shared vault</span>
            <p>
              Everyone deposits into an audited escrow. When the target is met, a Safe multisig deploys to hold the funds
              — and then the name. You all co-own it, in proportion to what you put in.
            </p>
          </div>
          <div className="feature">
            <span className="feature-k">No trust needed</span>
            <p>
              Until the buy happens, anyone can pull their own deposit out unilaterally — no one can freeze your funds.
              Buying the name needs a majority of co-owners to sign, so no single person can act alone.
            </p>
          </div>
          <div className="feature">
            <span className="feature-k">Non-custodial</span>
            <p>
              Coffer never holds your money. Funds live in the escrow contract and then your Safe — both on-chain,
              both yours. Ownership is always reconstructable from public deposits.
            </p>
          </div>
          <div className="feature">
            <span className="feature-k">Buy solo too</span>
            <p>
              Just want a name for yourself? Skip the vault and register it to your own wallet in one transaction. The
              group flow is there for when a name is worth splitting.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>How a vault works</h2>
        <div className="howto about-howto">
          <div className="howto-steps">
            <Step n={1}>Pick one ENS name and set a target — the total the vault needs to raise to buy it.</Step>
            <Step n={2}>Invite co-owners by ENS name or address. Everyone deposits toward the target.</Step>
            <Step n={3}>
              Once it&rsquo;s met, a shared Safe wallet is deployed to buy the name with. Each person co-owns it in
              proportion to their deposit.
            </Step>
            <Step n={4}>Buying needs a majority of co-owners to sign, so no one can act alone.</Step>
          </div>
        </div>
        <p className="about-note">
          Coffer currently runs on the <strong>Sepolia testnet</strong> — real flow, test ETH — while we put it through
          its paces. Mainnet follows.
        </p>
      </section>

      <section className="about-section built-by">
        <h2>Built by Namespace</h2>
        <p className="about-lead">
          Coffer is made by the <strong>Namespace</strong> team — an ENS-DAO-backed service provider building the
          naming and identity layer for Web3. Our mission is to name the next billion crypto users: gasless offchain
          subnames, onchain L1/L2 minting, and the developer tools that put ENS everywhere.
        </p>
        <p className="about-lead">
          Coffer even resolves every ENS name and address you see here through{" "}
          <a href="https://www.resolvio.xyz" target="_blank" rel="noreferrer">
            Resolvio
          </a>
          , our own universal ENS resolution service.
        </p>
        <div className="about-stats">
          <div className="stat">
            <span className="stat-n">850k+</span>
            <span className="stat-l">subnames issued</span>
          </div>
          <div className="stat">
            <span className="stat-n">16M+</span>
            <span className="stat-l">names resolved</span>
          </div>
          <div className="stat">
            <span className="stat-n">30+</span>
            <span className="stat-l">clients incl. Celo, POAP</span>
          </div>
        </div>
        <div className="about-cta">
          <a className="btn btn-primary" href="https://namespace.ninja" target="_blank" rel="noreferrer">
            namespace.ninja ↗
          </a>
        </div>
      </section>
    </div>
  );
}
