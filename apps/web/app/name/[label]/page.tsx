import Link from "next/link";
import WatchButton from "@/components/watch-button";
import DecayChart from "@/components/decay-chart";
import { usd } from "@/lib/data";
import { fmtEth, fmtCountdown } from "@/lib/format";
import { getEnsNameData, weiToUsd, type EnsNameData, DAY, GRACE, PREMIUM } from "@/lib/ens-name";
import { getNameSignals } from "@/lib/discover-feed";

// Watchers + pools for a name — the same signals that rank the Trending tab.
function NameSignalsLine({ watchers, pools }: { watchers: number; pools: number }) {
  return (
    <span className="name-stats" style={{ marginTop: 10 }}>
      <span className="name-stat" title={`${watchers} watching`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {watchers} watching
      </span>
      <span className="name-stat" title={`${pools} pool${pools === 1 ? "" : "s"} created`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <ellipse cx="12" cy="15" rx="9.5" ry="4.5" />
          <path d="M7 15V7.5a1.4 1.4 0 0 1 2.8 0V15" />
          <path d="M7 10h2.8" />
          <path d="M7 12.2h2.8" />
          <path d="M12.6 14.6c.7-.75 1.5-.75 2.2 0s1.5.75 2.2 0" />
        </svg>
        {pools} pool{pools === 1 ? "" : "s"}
      </span>
    </span>
  );
}

// Cache the rendered page ~60s per name (satisfies the spec's caching
// requirement): bounds mainnet RPC usage, and premium decay tolerates 60s
// staleness. HTML-level caching avoids the bigint-serialization problem that
// unstable_cache would hit on the wei fields.
export const revalidate = 60;

function fmtUsdWei(wei: bigint, ethUsd: number | null): string {
  const v = weiToUsd(wei, ethUsd);
  return v === null ? "—" : usd(v);
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_TAG: Record<EnsNameData["status"], { text: string; cls: string }> = {
  active: { text: "Registered", cls: "tag-finalized" },
  grace: { text: "In grace period", cls: "tag-funding" },
  premium: { text: "In temporary premium", cls: "tag-premium" },
  available: { text: "Available", cls: "tag-cheap" },
  tooShort: { text: "Too short", cls: "tag-funding" },
  invalid: { text: "Invalid", cls: "tag-funding" },
};

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="crumb" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          <Link href="/">Discover</Link> <span>/</span> <span>{label}.eth</span>
        </span>
        <WatchButton label={label} />
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <Shell label={label}>
      <div className="empty">
        <span className="mark" aria-hidden />
        <h3>{title}</h3>
        <p>{body}</p>
        <Link className="btn btn-primary" href="/">
          Browse names in premium
        </Link>
      </div>
    </Shell>
  );
}

export default async function NamePage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const raw = decodeURIComponent(label);

  let d: EnsNameData;
  try {
    d = await getEnsNameData(raw);
  } catch {
    return (
      <EmptyState
        label={raw.replace(/\.eth$/i, "")}
        title="Couldn’t load live price"
        body="We couldn’t reach mainnet ENS to read this name right now. Please try again in a moment."
      />
    );
  }

  const display = d.normalized || raw.replace(/\.eth$/i, "");

  if (d.status === "invalid") {
    return (
      <EmptyState
        label={display}
        title="Not a valid ENS name"
        body="That isn’t a registerable .eth label. Check the spelling and try again."
      />
    );
  }
  if (d.status === "tooShort") {
    return (
      <EmptyState
        label={display}
        title={`${display}.eth is too short to register`}
        body="ENS .eth names must be at least 3 characters. Try a longer name."
      />
    );
  }

  const tag = STATUS_TAG[d.status];
  const signals = await getNameSignals(display);

  // Non-buyable states (active / grace): show status, no buy box.
  if (!d.buyable) {
    const until = d.status === "active" ? d.expiry : d.expiry + GRACE;
    const body =
      d.status === "active"
        ? `This name is registered until ${fmtDate(until)}. It isn’t available to buy — it would need to expire and pass its 90-day grace period first.`
        : `This name expired and is in its 90-day grace period until ${fmtDate(until)}. The current owner can still renew it, so it can’t be pooled yet. If it isn’t renewed, it enters the 21-day premium auction after that.`;
    return (
      <Shell label={display}>
        <div className="page-head">
          <div>
            <div className="row" style={{ gap: 14 }}>
              <h1 style={{ fontSize: 46, margin: 0 }}>
                {display}
                <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
              </h1>
              <span className={`tag ${tag.cls}`}>{tag.text}</span>
            </div>
            <p>
              {d.letters} letters · {d.status === "active" ? "registered" : "in grace period"}
            </p>
            <NameSignalsLine watchers={signals.watchers} pools={signals.pools} />
          </div>
          <div className="row">
            <Link className="btn btn-ghost" href="/">
              ← Discover
            </Link>
          </div>
        </div>
        <div className="panel">
          <span className="panel-title">Status</span>
          <p className="muted" style={{ fontSize: 15 }}>
            {body}
          </p>
        </div>
      </Shell>
    );
  }

  // Buyable states (premium / available).
  const nowSec = Math.floor(Date.now() / 1000);
  const premiumEndsAt = d.expiry + GRACE + PREMIUM;
  const dayIntoPremium = d.status === "premium" ? Math.min(21, Math.max(0, Math.floor((nowSec - (d.expiry + GRACE)) / DAY))) : 0;

  return (
    <Shell label={display}>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 14 }}>
            <h1 style={{ fontSize: 46, margin: 0 }}>
              {display}
              <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
            </h1>
            <span className={`tag ${tag.cls}`}>{tag.text}</span>
          </div>
          <p>
            {d.letters} letters · {d.status === "premium" ? "in the 21-day premium auction" : "available at base price"}
          </p>
          <NameSignalsLine watchers={signals.watchers} pools={signals.pools} />
        </div>
        <div className="row">
          <Link className="btn btn-ghost" href="/">
            ← Discover
          </Link>
        </div>
      </div>

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <div className="spread" style={{ marginBottom: 14 }}>
              <span className="panel-title" style={{ margin: 0 }}>
                Premium price decay
              </span>
              {d.status === "premium" ? (
                <span className="tag tag-premium">NOW · DAY {dayIntoPremium}</span>
              ) : (
                <span className="tag tag-cheap">No premium</span>
              )}
            </div>
            <DecayChart nowDay={dayIntoPremium} showMarker={d.status === "premium"} />
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
                standard fee. The headline price is a live on-chain <span className="mono">rentPrice</span> read.
              </span>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Name details</span>
            <div>
              <div className="kv">
                <span className="k">Length</span>
                <span className="v">{d.letters} characters</span>
              </div>
              <div className="kv">
                <span className="k">Status</span>
                <span className="v">{tag.text}</span>
              </div>
              {d.expiry > 0 && (
                <div className="kv">
                  <span className="k">Released after</span>
                  <span className="v">{fmtDate(d.expiry + GRACE)}</span>
                </div>
              )}
              <div className="kv">
                <span className="k">Registrar</span>
                <span className="v">.eth</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Register for 1 year</span>
            <div className="kv">
              <span className="k">Registration (1 yr)</span>
              <span className="v">{fmtUsdWei(d.baseWei, d.ethUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Temporary premium</span>
              <span className="v">{fmtUsdWei(d.premiumWei, d.ethUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Total to buy now</span>
              <span className="v big accent">{fmtUsdWei(d.totalWei, d.ethUsd)}</span>
            </div>
            <div className="progress-label" style={{ marginTop: 6 }}>
              <span>≈ {fmtEth(d.totalWei, 3)}</span>
              {d.status === "premium" && <span>premium gone in {fmtCountdown(premiumEndsAt)}</span>}
            </div>
            <div className="row mt-16" style={{ gap: 10 }}>
              <Link className="btn btn-primary btn-lg" style={{ flex: 1 }} href={`/name/${display}/buy`}>
                Buy now (pay solo)
              </Link>
              <Link className="btn btn-soft btn-lg" style={{ flex: 1 }} href={`/pools/new?label=${display}`}>
                Start a pool to buy
              </Link>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Pools</span>
            <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
              Already a pool forming for {display}.eth? Browse every open pool on the escrow.
            </p>
            <div className="row mt-8" style={{ gap: 8 }}>
              <Link className="btn btn-ghost btn-sm" href="/pools">
                All pools →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
