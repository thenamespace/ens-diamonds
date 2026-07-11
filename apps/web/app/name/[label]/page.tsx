import Link from "next/link";
import DecayChart from "@/components/decay-chart";
import AddressLabel from "@/components/address-label";
import { getName, usd, usdToEth, eth } from "@/lib/data";

export default async function NamePage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const clean = decodeURIComponent(label).toLowerCase().replace(/\.eth$/, "");
  const n = getName(clean);

  if (!n) {
    return (
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Discover</Link> <span>/</span> <span>{clean}.eth</span>
        </div>
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>{clean}.eth isn&rsquo;t in premium right now</h3>
          <p>
            Coffer covers expired .eth names in their 21-day temporary-premium auction. This name may be actively
            registered, in its grace period, or not curated yet.
          </p>
          <Link className="btn btn-primary" href="/">
            Browse names in premium
          </Link>
        </div>
      </div>
    );
  }

  const total = n.registrationUsd + n.premiumUsd;

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <span>{n.label}.eth</span>
      </div>

      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 14 }}>
            <h1 style={{ fontSize: 46, margin: 0 }}>
              {n.label}
              <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
            </h1>
            <span className="tag tag-premium">In temporary premium</span>
          </div>
          <p>
            {n.letters} letters · first registered {n.firstRegistered} · expired {n.expiredDaysAgo}d ago · prev owner{" "}
            <AddressLabel address={n.prevOwner} />
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" href="/">
            ← Discover
          </Link>
          <Link className="btn btn-primary" href={`/pools/new?label=${n.label}`}>
            Start a pool to buy
          </Link>
        </div>
      </div>

      <div className="cols">
        {/* left: chart + explainer */}
        <div className="stack">
          <div className="panel">
            <div className="spread" style={{ marginBottom: 14 }}>
              <span className="panel-title" style={{ margin: 0 }}>
                Premium price decay
              </span>
              <span className="tag tag-premium">NOW · DAY {n.expiredDaysAgo - 90 > 0 ? n.expiredDaysAgo - 90 : 13}</span>
            </div>
            <DecayChart nowDay={13} />
            <div className="axis">
              <span>Day 0</span>
              <span>Day 7</span>
              <span>Day 14</span>
              <span>Day 21 · $0</span>
            </div>
            <div className="note note-info mt-16">
              <span>ℹ</span>
              <span>
                The premium starts near $100M and halves every day until it reaches $0 at day 21, added on top of the
                standard fee. The headline price is always a live on-chain <span className="mono">rentPrice</span> read.
              </span>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Name details</span>
            <div>
              <div className="kv">
                <span className="k">Length</span>
                <span className="v">{n.letters} characters</span>
              </div>
              <div className="kv">
                <span className="k">First registered</span>
                <span className="v">{n.firstRegistered}</span>
              </div>
              <div className="kv">
                <span className="k">Previous owner</span>
                <AddressLabel address={n.prevOwner} className="v" />
              </div>
              {n.twitter && (
                <div className="kv">
                  <span className="k">Twitter record</span>
                  <span className="v accent">{n.twitter}</span>
                </div>
              )}
              <div className="kv">
                <span className="k">Registrar</span>
                <span className="v">.eth</span>
              </div>
            </div>
          </div>
        </div>

        {/* right: buy box + pools */}
        <div className="stack">
          <div className="panel">
            <span className="panel-title">Register for 1 year</span>
            <div className="kv">
              <span className="k">Registration (1 yr)</span>
              <span className="v">{usd(n.registrationUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Temporary premium</span>
              <span className="v">{usd(n.premiumUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Total to buy now</span>
              <span className="v big accent">{usd(total)}</span>
            </div>
            <div className="progress-label" style={{ marginTop: 6 }}>
              <span>≈ {eth(usdToEth(total), 2)}</span>
              <span>
                premium gone in {n.daysLeft}d {n.hoursLeft}h
              </span>
            </div>
            <Link className="btn btn-primary btn-block btn-lg mt-16" href={`/pools/new?label=${n.label}`}>
              Start a pool to buy together
            </Link>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "var(--faint)" }}>
              {n.watching.toLocaleString()} watching · {n.poolsForming} pool{n.poolsForming === 1 ? "" : "s"} forming
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Pools</span>
            <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
              Start a pool for {n.label}.eth and invite people, or browse every open pool on the escrow.
            </p>
            <div className="row mt-8" style={{ gap: 8 }}>
              <Link className="btn btn-primary btn-sm" href={`/pools/new?label=${n.label}`}>
                Start a pool
              </Link>
              <Link className="btn btn-ghost btn-sm" href="/pools">
                All pools →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
