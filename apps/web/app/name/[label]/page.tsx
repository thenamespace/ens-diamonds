import Link from "next/link";
import { Alert } from "@thenamespace/uikit/alert";
import { buttonVariants } from "@thenamespace/uikit/button";
import { Card } from "@thenamespace/uikit/card";
import { Chip } from "@thenamespace/uikit/chip";
import { EmptyState } from "@thenamespace/uikit/empty-state";
import WatchButton from "@/components/watch-button";
import DecayChart from "@/components/decay-chart";
import { usd } from "@/lib/data";
import { fmtEth, fmtCountdown, shortLabel } from "@/lib/format";
import { getEnsNameData, weiToUsd, type EnsNameData, DAY, GRACE, PREMIUM } from "@/lib/ens-name";
import { getNameSignals } from "@/lib/discover-feed";

// Favourites + vaults for a name — the same signals that rank the Trending tab.
function NameSignalsLine({ watchers, pools }: { watchers: number; pools: number }) {
  return (
    <span className="mono mt-2.5 inline-flex items-center gap-3 text-[11.5px] text-muted">
      <span className="inline-flex items-center gap-1" title={`${watchers} favourite${watchers === 1 ? "" : "s"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <path
            d="M12 20.3 4.7 13a4.9 4.9 0 0 1 0-7 4.9 4.9 0 0 1 7 0l.3.3.3-.3a4.9 4.9 0 0 1 7 0 4.9 4.9 0 0 1 0 7z"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {watchers} favourite{watchers === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1" title={`${pools} vault${pools === 1 ? "" : "s"} created`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 12l2.3-2.3" />
        </svg>
        {pools} vault{pools === 1 ? "" : "s"}
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
  return v === null ? "-" : usd(v);
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type ChipColor = "accent" | "success" | "warning" | "danger" | "default";

const STATUS_TAG: Record<EnsNameData["status"], { text: string; color: ChipColor; chipClass?: string }> = {
  active: { text: "Registered", color: "success" },
  grace: { text: "In grace period", color: "accent" },
  // Premium gets its own soft purple — distinct from every other status.
  premium: { text: "In temporary premium", color: "accent", chipClass: "bg-[#efe8fb] text-[#7141c9]" },
  available: { text: "Available", color: "success" },
  tooShort: { text: "Too short", color: "accent" },
  invalid: { text: "Invalid", color: "accent" },
};

function StatusChip({ status }: { status: EnsNameData["status"] }) {
  const tag = STATUS_TAG[status];
  return (
    <Chip color={tag.color} variant="soft" size="sm" className={`mono text-[10.5px] uppercase tracking-[0.07em] ${tag.chipClass ?? ""}`}>
      {tag.text}
    </Chip>
  );
}

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="crumb" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          <Link href="/">Discover</Link> <span>/</span> <span title={`${label}.eth`}>{shortLabel(label)}.eth</span>
        </span>
        <WatchButton label={label} />
      </div>
      {children}
    </div>
  );
}

function NameEmptyState({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <Shell label={label}>
      <EmptyState size="lg">
        <EmptyState.Header>
          <EmptyState.Title>{title}</EmptyState.Title>
          <EmptyState.Description>{body}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Link className={buttonVariants({ variant: "primary" })} href="/">
            Browse names in premium
          </Link>
        </EmptyState.Content>
      </EmptyState>
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
      <NameEmptyState
        label={raw.replace(/\.eth$/i, "")}
        title="Couldn’t load live price"
        body="We couldn’t reach mainnet ENS to read this name right now. Please try again in a moment."
      />
    );
  }

  const display = d.normalized || raw.replace(/\.eth$/i, "");

  if (d.status === "invalid") {
    return (
      <NameEmptyState
        label={display}
        title="Not a valid ENS name"
        body="That isn’t a registerable .eth label. Check the spelling and try again."
      />
    );
  }
  if (d.status === "tooShort") {
    return (
      <NameEmptyState
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
        ? `This name is registered until ${fmtDate(until)}. It isn’t available to buy. It would need to expire and pass its 90-day grace period first.`
        : `This name expired and is in its 90-day grace period until ${fmtDate(until)}. The current owner can still renew it, so it can’t be pooled yet. If it isn’t renewed, it enters the 21-day premium auction after that.`;
    return (
      <Shell label={display}>
        <div className="page-head">
          <div>
            <div className="row" style={{ gap: 14 }}>
              <h1 style={{ fontSize: 46, margin: 0 }} title={`${display}.eth`}>
                {shortLabel(display)}
                <span className="font-normal text-muted">.eth</span>
              </h1>
              <StatusChip status={d.status} />
            </div>
            <p>
              {d.letters} letters · {d.status === "active" ? "registered" : "in grace period"}
            </p>
            <NameSignalsLine watchers={signals.watchers} pools={signals.pools} />
          </div>
          <div className="row">
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              ← Discover
            </Link>
          </div>
        </div>
        <Card>
          <Card.Header>
            <Card.Title>Status</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="m-0 text-[15px] text-muted">{body}</p>
          </Card.Content>
        </Card>
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
            <h1 style={{ fontSize: 46, margin: 0 }} title={`${display}.eth`}>
              {shortLabel(display)}
              <span className="font-normal text-muted">.eth</span>
            </h1>
            <StatusChip status={d.status} />
          </div>
          <p>
            {d.letters} letters · {d.status === "premium" ? "in the 21-day premium auction" : "available at base price"}
          </p>
          <NameSignalsLine watchers={signals.watchers} pools={signals.pools} />
        </div>
        <div className="row">
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            ← Discover
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[22px] min-[901px]:grid-cols-[1.4fr_0.9fr]">
        <div className="stack">
          <Card>
            <Card.Header className="flex-row items-center justify-between">
              <Card.Title>Premium price decay</Card.Title>
              {d.status === "premium" ? (
                <Chip color="accent" variant="soft" size="sm" className="mono text-[10.5px] uppercase tracking-[0.07em]">
                  NOW · DAY {dayIntoPremium}
                </Chip>
              ) : (
                <Chip color="success" variant="soft" size="sm" className="mono text-[10.5px] uppercase tracking-[0.07em]">
                  No premium
                </Chip>
              )}
            </Card.Header>
            <Card.Content>
              <DecayChart nowDay={dayIntoPremium} showMarker={d.status === "premium"} />
              <div className="mono mt-2 flex justify-between text-[11px] text-muted">
                <span>Day 0</span>
                <span>Day 7</span>
                <span>Day 14</span>
                <span>Day 21 · $0</span>
              </div>
              <Alert status="accent" className="mt-4">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    The premium starts near $100M and halves every day until it reaches $0 at day 21, added on top of
                    the standard fee. The headline price is a live onchain <span className="mono">rentPrice</span>{" "}
                    read.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Name details</Card.Title>
            </Card.Header>
            <Card.Content>
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
            </Card.Content>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Register for 1 year</Card.Title>
            </Card.Header>
            <Card.Content>
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
              <div className="mono mt-1.5 flex justify-between text-[13px] text-muted">
                <span>≈ {fmtEth(d.totalWei, 3)}</span>
                {d.status === "premium" && <span>premium gone in {fmtCountdown(premiumEndsAt)}</span>}
              </div>
              <div className="row mt-4" style={{ gap: 10 }}>
                <Link
                  className={buttonVariants({ variant: "primary", size: "lg", className: "flex-1" })}
                  href={`/name/${display}/buy`}
                >
                  Buy now (pay solo)
                </Link>
                <Link
                  className={buttonVariants({ variant: "secondary", size: "lg", className: "flex-1" })}
                  href={`/pools/new?label=${display}`}
                >
                  Start a vault to buy
                </Link>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Vaults</Card.Title>
              <Card.Description className="mt-2">
                Already a vault forming for {shortLabel(display)}.eth? Browse every open vault on the escrow.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="row" style={{ gap: 8 }}>
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/pools">
                  All vaults →
                </Link>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
